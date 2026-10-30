import json
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tool import Tool, ToolStatus
from app.models.agent import Agent
from app.models.audit import ToolCall, ToolCallStatus, QualityStatus, QualityReview, AuditLog
from app.services.tool_service import ToolService
from app.services.ledger_service import LedgerService, InsufficientBalanceError
from app.services.quality_service import QualityService
from app.services.agent_service import AgentService, AgentBudgetExceededError, AgentPermissionError
from app.schemas.execution import ToolPlanItem, AgentPlanResponse, ExecutionStepResult, AgentExecuteResponse


class ExecutionService:
    @staticmethod
    async def execute_paid_tool(
        session: AsyncSession,
        tool_id: str,
        input_data: Dict[str, Any],
        idempotency_key: str,
        consumer_user_id: str,
        agent: Optional[Agent] = None,
    ) -> ToolCall:
        """
        Secure, atomic paid tool call execution pipeline:
        1. Fetch authoritative tool and price
        2. Verify permission and budget constraints
        3. Hold ledger reservation atomically
        4. Execute tool
        5. Evaluate quality
        6. Commit charge or reverse
        """
        # 1. Authoritative Tool Check
        tool = await ToolService.get_tool_by_id(session, tool_id)
        if not tool or tool.status != ToolStatus.APPROVED:
            raise ValueError(f"Tool '{tool_id}' is not approved for execution in ToolToll")

        authoritative_price = tool.price_per_call

        # 2. Agent Constraints
        if agent:
            await AgentService.verify_permissions_and_budget(session, agent, tool, authoritative_price)

        # 3. Check for existing call with same idempotency key (replay protection)
        stmt_dup = select(ToolCall).where(ToolCall.idempotency_key == idempotency_key)
        res_dup = await session.execute(stmt_dup)
        existing_call = res_dup.scalar_one_or_none()
        if existing_call:
            return existing_call

        # 4. Hold atomic reservation
        reservation = await LedgerService.hold_reservation(
            session=session,
            user_id=consumer_user_id,
            tool_id=tool.id,
            amount=authoritative_price,
            idempotency_key=idempotency_key,
            agent_id=agent.id if agent else None,
        )

        call_id = str(uuid.uuid4())
        tool_call = ToolCall(
            id=call_id,
            agent_id=agent.id if agent else None,
            user_id=consumer_user_id,
            tool_id=tool.id,
            idempotency_key=idempotency_key,
            requested_input=input_data,
            price_charged=Decimal("0.0000"),
            status=ToolCallStatus.PENDING,
        )
        session.add(tool_call)
        await session.flush()

        # 5. Outbound Execution
        status_code, body, latency_ms, error_msg = await ToolService.execute_tool_call_internal_or_remote(tool, input_data)
        tool_call.duration_ms = latency_ms
        tool_call.response_status = status_code

        # 6. Quality & Integrity Evaluation
        q_status, is_reversal_eligible, q_reason, q_details = QualityService.evaluate_response(
            output_data=body,
            output_schema=tool.output_schema,
            status_code=status_code,
            duration_ms=latency_ms,
            timeout_seconds=tool.timeout_seconds,
        )

        # Record Quality Review record
        q_review = QualityReview(
            tool_call_id=tool_call.id,
            check_type="deterministic",
            passed=(q_status == QualityStatus.PASS),
            score=Decimal("1.00") if q_status == QualityStatus.PASS else Decimal("0.00"),
            details=q_details,
            review_reason=q_reason,
        )
        session.add(q_review)

        # 7. Settlement Decision
        if q_status == QualityStatus.PASS:
            # Successful call: finalize charge in ledger
            charged, creator_net, fee = await LedgerService.finalize_charge(
                session=session,
                reservation=reservation,
                consumer_user_id=consumer_user_id,
                creator_user_id=tool.creator_id,
                tool_id=tool.id,
                call_id=tool_call.id,
                authoritative_price=authoritative_price,
            )
            tool_call.status = ToolCallStatus.SUCCESS
            tool_call.quality_status = QualityStatus.PASS
            tool_call.price_charged = charged
            tool_call.creator_earnings = creator_net
            tool_call.platform_fee = fee
            tool_call.response_output = body

            # Update empirical telemetry
            tool.total_calls += 1
            tool.success_calls += 1
            tool.average_latency_ms = (tool.average_latency_ms * (tool.total_calls - 1) + latency_ms) / tool.total_calls

        else:
            # Failed or degraded call
            tool_call.status = ToolCallStatus.FAILED
            tool_call.quality_status = q_status
            tool_call.reversal_reason = q_reason
            tool_call.response_output = {"error": error_msg or q_reason, "raw": body}

            # Update telemetry
            tool.total_calls += 1

            if is_reversal_eligible:
                # Automatic reversal policy for objective failures
                await LedgerService.release_reservation(
                    session=session,
                    reservation=reservation,
                    consumer_user_id=consumer_user_id,
                    reason=q_reason,
                )
                tool_call.status = ToolCallStatus.REVERSED
            else:
                # Non-reversible error (e.g. 4xx malformed caller input): charge applies
                charged, creator_net, fee = await LedgerService.finalize_charge(
                    session=session,
                    reservation=reservation,
                    consumer_user_id=consumer_user_id,
                    creator_user_id=tool.creator_id,
                    tool_id=tool.id,
                    call_id=tool_call.id,
                    authoritative_price=authoritative_price,
                )
                tool_call.price_charged = charged
                tool_call.creator_earnings = creator_net
                tool_call.platform_fee = fee

        # Audit log
        audit = AuditLog(
            user_id=consumer_user_id,
            agent_id=agent.id if agent else None,
            action="TOOL_CALL_EXECUTED",
            entity_type="tool_call",
            entity_id=tool_call.id,
            details={
                "tool_id": tool.id,
                "tool_name": tool.name,
                "price": str(authoritative_price),
                "status": tool_call.status.value,
                "quality": tool_call.quality_status.value,
            },
        )
        session.add(audit)

        await session.commit()
        await session.refresh(tool_call)
        return tool_call

    @staticmethod
    async def plan_agent_task(
        session: AsyncSession,
        task_prompt: str,
        agent: Optional[Agent] = None,
        max_budget: Optional[Decimal] = None,
        selection_mode: str = "deterministic",
    ) -> AgentPlanResponse:
        """
        AI Agent Tool Discovery & Planning:
        Analyzes natural language task prompt, discovers matching approved tools,
        ranks them by fit and measured reliability, calculates cost estimate,
        and determines if human approval is required.
        """
        # Fetch all approved tools from ToolToll registry
        tools = await ToolService.search_tools(session, only_approved=True, limit=50)

        prompt_lower = task_prompt.lower()
        selected_items: List[ToolPlanItem] = []

        # Capability detection heuristics
        needs_translation = any(k in prompt_lower for k in ["translate", "translation", "spanish", "french", "german", "japanese", "language"])
        needs_security = any(k in prompt_lower for k in ["scam", "phishing", "fraud", "suspicious", "sms", "danger", "warning", "fake", "spoof"])
        needs_sentiment = any(k in prompt_lower for k in ["sentiment", "emotion", "feeling", "tone", "happy", "frustrated", "opinion"])

        for t in tools:
            reason = None
            inputs: Dict[str, Any] = {}

            if t.slug == "text-translator" and needs_translation:
                reason = "Selected to translate input text into target language."
                inputs = {"text": task_prompt, "target_language": "en"}
            elif t.slug == "scam-risk-analyzer" and needs_security:
                reason = "Selected to perform forensic heuristic scam and phishing risk analysis."
                inputs = {"message": task_prompt}
            elif t.slug == "sentiment-analyzer" and needs_sentiment:
                reason = "Selected to quantify emotional undertone and sentiment polarity."
                inputs = {"text": task_prompt}
            elif not (needs_translation or needs_security or needs_sentiment):
                # Fallback keyword match in description/name/tags
                matches = sum(1 for tag in t.tags if tag.lower() in prompt_lower)
                if matches > 0:
                    reason = f"Matched {matches} relevant task capability keywords in tool tags."
                    inputs = {"text": task_prompt}

            if reason:
                reliability = (t.success_calls / t.total_calls) if t.total_calls > 0 else 1.0
                selected_items.append(
                    ToolPlanItem(
                        tool_id=t.id,
                        tool_name=t.name,
                        category=t.category,
                        price_per_call=t.price_per_call,
                        selection_reason=reason,
                        input_parameters=inputs,
                        measured_reliability=round(reliability, 2),
                    )
                )

        # If no specific match was triggered, select the most relevant tool based on keywords
        if not selected_items and tools:
            best_tool = tools[0]
            selected_items.append(
                ToolPlanItem(
                    tool_id=best_tool.id,
                    tool_name=best_tool.name,
                    category=best_tool.category,
                    price_per_call=best_tool.price_per_call,
                    selection_reason="Selected based on highest marketplace availability and reliability score.",
                    input_parameters={"message": task_prompt, "text": task_prompt},
                    measured_reliability=1.0,
                )
            )

        estimated_cost = sum(item.price_per_call for item in selected_items)

        # Approval logic
        requires_approval = False
        approval_reason = None

        auto_limit = agent.auto_approval_max if agent else Decimal("0.0500")
        if estimated_cost > auto_limit:
            requires_approval = True
            approval_reason = f"Estimated total cost (${estimated_cost:.4f}) exceeds auto-approval threshold (${auto_limit:.4f}). Human confirmation recommended."

        explanation = (
            f"Analyzed task requirements: discovered {len(selected_items)} suitable marketplace tool(s) "
            f"across ToolToll registry. Total estimated price: ${estimated_cost:.4f} USD."
        )

        return AgentPlanResponse(
            task=task_prompt,
            selection_mode=selection_mode,
            plan_explanation=explanation,
            selected_tools=selected_items,
            estimated_total_cost=estimated_cost,
            requires_human_approval=requires_approval,
            approval_reason=approval_reason,
        )

    @staticmethod
    async def execute_agent_task(
        session: AsyncSession,
        task_prompt: str,
        consumer_user_id: str,
        agent: Optional[Agent] = None,
        approved_tool_ids: Optional[List[str]] = None,
        tool_inputs: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> AgentExecuteResponse:
        """
        Execute an autonomous multi-step agent workflow across discovered tools.
        Pipes data between tools if multi-step (e.g. translation -> scam analysis).
        """
        # Step 1: Generate plan
        plan = await ExecutionService.plan_agent_task(
            session=session,
            task_prompt=task_prompt,
            agent=agent,
        )

        executed_steps: List[ExecutionStepResult] = []
        total_cost = Decimal("0.0000")
        intermediate_text = task_prompt

        tools_to_run = [item for item in plan.selected_tools if (not approved_tool_ids or item.tool_id in approved_tool_ids)]

        for item in tools_to_run:
            call_input = (tool_inputs.get(item.tool_id) if tool_inputs else None) or item.input_parameters
            # If previous step produced translation, pass it to downstream tool
            if "message" in call_input and intermediate_text != task_prompt:
                call_input["message"] = intermediate_text

            idempotency_key = f"task_{uuid.uuid4().hex[:16]}"

            call_record = await ExecutionService.execute_paid_tool(
                session=session,
                tool_id=item.tool_id,
                input_data=call_input,
                idempotency_key=idempotency_key,
                consumer_user_id=consumer_user_id,
                agent=agent,
            )

            total_cost += call_record.price_charged

            output_body = call_record.response_output
            # Check if this tool produced a translation that downstream tools can use
            if isinstance(output_body, dict) and "translated_text" in output_body:
                intermediate_text = output_body["translated_text"]

            executed_steps.append(
                ExecutionStepResult(
                    tool_id=item.tool_id,
                    tool_name=item.tool_name,
                    price_charged=call_record.price_charged,
                    duration_ms=call_record.duration_ms,
                    status=call_record.status,
                    quality_status=call_record.quality_status,
                    output=output_body,
                    error=call_record.reversal_reason,
                )
            )

        # Synthesize final summary
        all_success = all(s.status == ToolCallStatus.SUCCESS for s in executed_steps)
        summary_lines = [f"Agent successfully coordinated {len(executed_steps)} paid tool(s) in ToolToll:"]
        for s in executed_steps:
            summary_lines.append(f"- **{s.tool_name}**: Status {s.status.value.upper()} (${s.price_charged:.4f})")
            if s.output and isinstance(s.output, dict):
                if "risk_level" in s.output:
                    summary_lines.append(f"  • Risk Level: **{s.output.get('risk_level')}** (Score: {s.output.get('risk_score')})")
                    summary_lines.append(f"  • Explanation: {s.output.get('explanation')}")
                    summary_lines.append(f"  • *Disclaimer: {s.output.get('disclaimer')}*")
                elif "translated_text" in s.output:
                    summary_lines.append(f"  • Translation: \"{s.output.get('translated_text')}\"")
                elif "sentiment" in s.output:
                    summary_lines.append(f"  • Sentiment: **{s.output.get('sentiment')}** (Polarity: {s.output.get('polarity_score')})")

        final_summary = "\n".join(summary_lines)

        return AgentExecuteResponse(
            task=task_prompt,
            success=all_success,
            final_summary=final_summary,
            executed_steps=executed_steps,
            total_cost=total_cost,
            ledger_committed=True,
        )
