import json
from typing import Dict, List, Optional, Set
import jsonschema

from app.clients.backend_client import backend_client, BackendToolRecord
from app.clients.llm_client import llm_client
from app.core.config import settings
from app.core.exceptions import (
    BudgetExceededError,
    LLMConfigurationError,
    PlanValidationError,
)
from app.core.logging import logger
from app.modules.agent_planner.prompts import PLANNER_SYSTEM_PROMPT, build_planning_prompt
from app.modules.agent_planner.schemas import (
    AgentPlanRequest,
    AgentPlanResponse,
    LLMPlanOutput,
    PlanStep,
)


class AgentPlannerService:
    async def create_plan(
        self,
        request: AgentPlanRequest,
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> AgentPlanResponse:
        # Step 1: Ensure Claude is configured
        if not llm_client.is_configured:
            raise LLMConfigurationError(
                "Claude LLM is not configured (missing ANTHROPIC_API_KEY). "
                "Agent planning requires a real LLM provider."
            )

        max_budget = request.max_budget_usd or settings.DEFAULT_MAX_BUDGET_USD
        max_steps = request.max_steps or settings.DEFAULT_MAX_PLAN_STEPS

        # Step 2: Fetch active approved catalog from backend
        catalog: List[BackendToolRecord] = await backend_client.list_approved_tools(
            auth_headers=auth_headers
        )

        # Filter by allowed tool IDs if provided
        if request.allowed_tool_ids:
            catalog = [t for t in catalog if t.id in request.allowed_tool_ids]

        if not catalog:
            return AgentPlanResponse(
                task=request.task_prompt,
                is_achievable=False,
                impossibility_reason="No approved tools are available in the marketplace to fulfill this task.",
                plan_explanation="Cannot generate plan: tool catalog is empty or all tools are restricted.",
                steps=[],
                total_estimated_cost_usd=0.0,
                total_estimated_cost_micro_dollars=0,
                step_count=0,
                requires_human_approval=False,
            )

        # Prepare tool catalog summary for prompt
        catalog_dict_list = []
        tools_by_id: Dict[str, BackendToolRecord] = {}
        for t in catalog:
            tools_by_id[t.id] = t
            catalog_dict_list.append({
                "tool_id": t.id,
                "name": t.name,
                "category": t.category,
                "description": t.short_desc,
                "price_usd": t.price_per_call,
                "input_schema": t.input_schema,
            })

        catalog_json = json.dumps(catalog_dict_list, indent=2)
        prompt = build_planning_prompt(
            task=request.task_prompt,
            tool_catalog_json=catalog_json,
            max_budget_usd=max_budget,
        )

        # Step 3: Call Claude for structured plan output
        llm_output: LLMPlanOutput = await llm_client.generate_structured(
            schema_class=LLMPlanOutput,
            prompt=prompt,
            system_prompt=PLANNER_SYSTEM_PROMPT,
            model=settings.ANTHROPIC_MODEL,
            temperature=0.1,
        )

        if not llm_output.is_achievable:
            return AgentPlanResponse(
                task=request.task_prompt,
                is_achievable=False,
                impossibility_reason=llm_output.impossibility_reason or "Claude determined the task cannot be achieved with available tools.",
                plan_explanation=llm_output.plan_explanation,
                steps=[],
                total_estimated_cost_usd=0.0,
                total_estimated_cost_micro_dollars=0,
                step_count=0,
                requires_human_approval=False,
            )

        # Step 4: Strict Plan Validation
        validated_steps = self._validate_and_sanitize_steps(
            steps=llm_output.steps,
            tools_by_id=tools_by_id,
            max_steps=max_steps,
        )

        # Step 5: Check cost & budget outside the LLM
        total_cost = sum(s.estimated_cost_usd for s in validated_steps)
        if total_cost > max_budget:
            raise BudgetExceededError(
                f"Generated plan exceeds budget cap: estimated ${total_cost:.4f} USD > max ${max_budget:.4f} USD."
            )

        total_micro_dollars = int(round(total_cost * settings.MICRO_DOLLARS_PER_USD))
        requires_approval = total_cost > settings.DEFAULT_PER_CALL_LIMIT_USD

        return AgentPlanResponse(
            task=request.task_prompt,
            is_achievable=True,
            impossibility_reason=None,
            plan_explanation=llm_output.plan_explanation,
            steps=validated_steps,
            total_estimated_cost_usd=round(total_cost, 4),
            total_estimated_cost_micro_dollars=total_micro_dollars,
            step_count=len(validated_steps),
            requires_human_approval=requires_approval,
            approval_reason=(
                f"Total plan cost (${total_cost:.4f}) exceeds automatic approval threshold (${settings.DEFAULT_PER_CALL_LIMIT_USD:.4f})"
                if requires_approval else None
            ),
        )

    def _validate_and_sanitize_steps(
        self,
        steps: List[PlanStep],
        tools_by_id: Dict[str, BackendToolRecord],
        max_steps: int,
    ) -> List[PlanStep]:
        if len(steps) > max_steps:
            raise PlanValidationError(f"Plan exceeds maximum step limit: {len(steps)} > {max_steps}")

        step_ids: Set[str] = set()
        validated: List[PlanStep] = []

        # Validate step IDs and tool IDs
        for s in steps:
            if s.step_id in step_ids:
                raise PlanValidationError(f"Duplicate step ID '{s.step_id}' in plan.")
            step_ids.add(s.step_id)

            tool = tools_by_id.get(s.tool_id)
            if not tool:
                raise PlanValidationError(
                    f"Plan selected unregistered or unapproved tool ID '{s.tool_id}'."
                )

            # Authoritative pricing from backend data, NOT LLM hallucination
            s.estimated_cost_usd = tool.price_per_call
            s.tool_name = tool.name

            # Validate input parameters against tool schema if provided
            if tool.input_schema and isinstance(tool.input_schema, dict) and "properties" in tool.input_schema:
                try:
                    jsonschema.validate(instance=s.input_parameters, schema=tool.input_schema)
                except jsonschema.ValidationError as err:
                    logger.warning(f"Plan step {s.step_id} schema warning: {err.message}")

            validated.append(s)

        # Circular dependency check using topological sort (Kahn's algorithm)
        in_degree: Dict[str, int] = {s.step_id: 0 for s in validated}
        adjacency: Dict[str, List[str]] = {s.step_id: [] for s in validated}

        for s in validated:
            for dep in s.depends_on_step_ids:
                if dep not in step_ids:
                    raise PlanValidationError(
                        f"Step '{s.step_id}' references non-existent dependency '{dep}'."
                    )
                adjacency[dep].append(s.step_id)
                in_degree[s.step_id] += 1

        queue = [s_id for s_id, deg in in_degree.items() if deg == 0]
        processed = 0
        while queue:
            node = queue.pop(0)
            processed += 1
            for neighbor in adjacency[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if processed != len(validated):
            raise PlanValidationError("Circular dependency detected in execution plan steps.")

        return validated


planner_service = AgentPlannerService()
