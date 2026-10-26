import json
import uuid
from typing import Any, Dict, List, Optional

from app.clients.backend_client import backend_client, PaidCallExecutionResult
from app.clients.llm_client import llm_client
from app.core.config import settings
from app.core.logging import logger
from app.modules.agent_planner.schemas import AgentPlanRequest, PlanStep
from app.modules.agent_planner.service import planner_service
from app.modules.demo_agent.schemas import (
    DemoAgentRunRequest,
    DemoAgentRunResponse,
    StepExecutionDetail,
)
from app.modules.quality_judge.schemas import JudgeEvaluateRequest
from app.modules.quality_judge.service import quality_judge_service
from app.modules.tool_discovery.schemas import ToolDiscoveryRequest
from app.modules.tool_discovery.service import discovery_service


class DemoAgentService:
    async def run_workflow(
        self,
        request: DemoAgentRunRequest,
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> DemoAgentRunResponse:
        """
        End-to-end autonomous agent workflow:
        1. Discover relevant tools from ToolToll catalog.
        2. Plan execution sequence with Claude or fallback.
        3. Enforce budget limits.
        4. Execute calls through the real ToolToll paid gateway.
        5. Pass outputs through Quality Judge.
        6. Synthesize comprehensive report.
        """
        # Step 1: Discover Tools
        discovery_res = await discovery_service.discover_tools(
            request=ToolDiscoveryRequest(
                task_prompt=request.task_prompt,
                max_price=request.max_budget_usd,
                limit=5,
            ),
            auth_headers=auth_headers,
        )

        if not discovery_res.matches:
            return DemoAgentRunResponse(
                task=request.task_prompt,
                success=False,
                final_summary="No approved tools were found in the ToolToll marketplace to fulfill this task.",
                total_cost_usd=0.0,
                total_cost_micro_dollars=0,
                executed_steps=[],
                tools_discovered_count=0,
                gateway_verified=False,
            )

        # Step 2: Formulate Plan Steps
        steps_to_execute: List[PlanStep] = []
        if llm_client.is_configured:
            try:
                plan_res = await planner_service.create_plan(
                    request=AgentPlanRequest(
                        task_prompt=request.task_prompt,
                        max_budget_usd=request.max_budget_usd,
                        allowed_tool_ids=[t.tool_id for t in discovery_res.matches],
                    ),
                    auth_headers=auth_headers,
                )
                if plan_res.is_achievable and plan_res.steps:
                    steps_to_execute = plan_res.steps
            except Exception as e:
                logger.warning(f"Claude planning failed: {e}. Falling back to top discovered tool.")

        # Fallback to top discovered tool if Claude planning was unconfigured or skipped
        if not steps_to_execute:
            top_tool = discovery_res.matches[0]
            # Construct sensible sample input from schema if not provided in overrides
            sample_input: Dict[str, Any] = {}
            if request.tool_inputs_override and top_tool.tool_id in request.tool_inputs_override:
                sample_input = request.tool_inputs_override[top_tool.tool_id]
            else:
                props = top_tool.input_schema.get("properties", {})
                for prop_name, prop_meta in props.items():
                    sample_input[prop_name] = request.task_prompt

            steps_to_execute = [
                PlanStep(
                    step_id="step_1",
                    tool_id=top_tool.tool_id,
                    tool_name=top_tool.name,
                    explanation=f"Execute {top_tool.name} to address user prompt.",
                    input_parameters=sample_input,
                    estimated_cost_usd=top_tool.price_per_call,
                )
            ]

        # Step 3: Enforce Budget Check
        projected_cost = sum(s.estimated_cost_usd for s in steps_to_execute)
        if request.max_budget_usd and projected_cost > request.max_budget_usd:
            return DemoAgentRunResponse(
                task=request.task_prompt,
                success=False,
                final_summary=f"Plan rejected: projected cost (${projected_cost:.4f}) exceeds budget cap (${request.max_budget_usd:.4f}).",
                total_cost_usd=0.0,
                total_cost_micro_dollars=0,
                executed_steps=[],
                tools_discovered_count=len(discovery_res.matches),
                gateway_verified=False,
            )

        # Step 4: Execute through ToolToll Gateway
        executed_details: List[StepExecutionDetail] = []
        total_charged = 0.0

        for step in steps_to_execute:
            # Apply input overrides if supplied
            input_data = step.input_parameters
            if request.tool_inputs_override and step.tool_id in request.tool_inputs_override:
                input_data = request.tool_inputs_override[step.tool_id]

            idempotency_key = f"demo_exec_{uuid.uuid4().hex[:16]}"

            try:
                # Paid tool execution strictly via main ToolToll Gateway
                result: PaidCallExecutionResult = await backend_client.execute_paid_tool(
                    tool_id=step.tool_id,
                    input_data=input_data,
                    idempotency_key=idempotency_key,
                    auth_headers=auth_headers,
                )

                total_charged += result.price_charged
                micro_dollars = int(round(result.price_charged * settings.MICRO_DOLLARS_PER_USD))

                # Step 5: Quality Judge Evaluation
                judge_eval = await quality_judge_service.evaluate(
                    request=JudgeEvaluateRequest(
                        call_id=result.call_id,
                        tool_id=step.tool_id,
                        tool_name=step.tool_name,
                        request_input=input_data,
                        response_output=result.response_output,
                        duration_ms=result.duration_ms,
                    )
                )

                executed_details.append(
                    StepExecutionDetail(
                        step_id=step.step_id,
                        tool_id=step.tool_id,
                        tool_name=step.tool_name,
                        call_id=result.call_id,
                        status=result.status,
                        price_charged=result.price_charged,
                        price_micro_dollars=micro_dollars,
                        duration_ms=result.duration_ms,
                        output=result.response_output,
                        quality_verdict=judge_eval.verdict,
                        quality_reason=judge_eval.reason,
                        refund_recommended=judge_eval.refund_recommended,
                    )
                )

                # Stop pipeline if a step fails or is reversed
                if result.status != "success":
                    break

            except Exception as e:
                logger.error(f"Gateway execution failure for step {step.step_id} (tool {step.tool_id}): {e}")
                executed_details.append(
                    StepExecutionDetail(
                        step_id=step.step_id,
                        tool_id=step.tool_id,
                        tool_name=step.tool_name,
                        call_id=f"failed_{step.step_id}",
                        status="failed",
                        price_charged=0.0,
                        price_micro_dollars=0,
                        duration_ms=0.0,
                        output=None,
                        quality_verdict="bad",
                        quality_reason=f"Gateway execution error: {str(e)}",
                        refund_recommended=False,
                        error=str(e),
                    )
                )
                break

        # Step 6: Final Synthesis
        is_successful = len(executed_details) > 0 and all(
            d.status == "success" for d in executed_details
        )
        total_micro = int(round(total_charged * settings.MICRO_DOLLARS_PER_USD))

        final_summary = await self._generate_final_summary(
            task=request.task_prompt,
            steps=executed_details,
            is_successful=is_successful,
        )

        return DemoAgentRunResponse(
            task=request.task_prompt,
            success=is_successful,
            final_summary=final_summary,
            total_cost_usd=round(total_charged, 4),
            total_cost_micro_dollars=total_micro,
            executed_steps=executed_details,
            tools_discovered_count=len(discovery_res.matches),
            gateway_verified=True,
        )

    async def _generate_final_summary(
        self,
        task: str,
        steps: List[StepExecutionDetail],
        is_successful: bool,
    ) -> str:
        if not steps:
            return "Task terminated before any tools could be executed."

        if llm_client.is_configured and is_successful:
            prompt = (
                f"User Task: {task}\n\n"
                f"Execution Results:\n"
                f"{json.dumps([{'tool': s.tool_name, 'output': s.output} for s in steps], indent=2)}\n\n"
                f"Provide a clear, professional answer to the user's task based solely on the executed tool results."
            )
            try:
                summary = await llm_client.generate_text(
                    prompt=prompt,
                    system_prompt="You are an autonomous agent presenting verified results to a user.",
                    model=settings.ANTHROPIC_MODEL,
                    temperature=0.2,
                )
                return summary.strip()
            except Exception as e:
                logger.warning(f"Claude final summary generation failed: {e}")

        # Deterministic summary fallback
        summary_lines = [f"### ToolToll Workflow Execution Report for: '{task}'"]
        for s in steps:
            summary_lines.append(
                f"- **{s.tool_name}** (`{s.status}`): Output: {json.dumps(s.output) if s.output else s.error} | Quality: `{s.quality_verdict}`"
            )
        if not is_successful:
            summary_lines.append("\n⚠️ Notice: Workflow encountered errors during paid tool execution.")
        return "\n".join(summary_lines)


demo_agent_service = DemoAgentService()
