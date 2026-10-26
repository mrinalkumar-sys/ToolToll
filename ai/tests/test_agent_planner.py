from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient

from app.clients.backend_client import BackendToolRecord
from app.core.exceptions import BudgetExceededError, LLMConfigurationError, PlanValidationError
from app.modules.agent_planner.schemas import (
    AgentPlanRequest,
    LLMPlanOutput,
    PlanStep,
)
from app.modules.agent_planner.service import planner_service


@pytest.fixture
def mock_approved_tools():
    return [
        BackendToolRecord(
            id="tool-scam",
            name="Scam Number Lookup",
            category="security",
            short_desc="Checks scam phone numbers",
            base_url="https://api.scam.org",
            price_per_call=0.0200,
            status="approved",
            input_schema={"type": "object", "properties": {"phone": {"type": "string"}}},
        ),
        BackendToolRecord(
            id="tool-sms",
            name="SMS Sender",
            category="communication",
            short_desc="Sends SMS alerts",
            base_url="https://api.sms.org",
            price_per_call=0.0300,
            status="approved",
            input_schema={"type": "object", "properties": {"message": {"type": "string"}}},
        ),
    ]


@pytest.mark.asyncio
async def test_planner_unconfigured_llm_raises(mock_approved_tools):
    with patch("app.clients.llm_client.llm_client.is_configured", False):
        with pytest.raises(LLMConfigurationError):
            await planner_service.create_plan(
                AgentPlanRequest(task_prompt="Check scam number")
            )


@pytest.mark.asyncio
async def test_planner_valid_plan(mock_approved_tools):
    mock_llm_output = LLMPlanOutput(
        is_achievable=True,
        plan_explanation="First check scam database, then alert user via SMS",
        steps=[
            PlanStep(
                step_id="step_1",
                tool_id="tool-scam",
                tool_name="Scam Number Lookup",
                explanation="Analyze phone number",
                input_parameters={"phone": "+18005550199"},
                estimated_cost_usd=0.0200,
            ),
            PlanStep(
                step_id="step_2",
                tool_id="tool-sms",
                tool_name="SMS Sender",
                explanation="Alert customer",
                input_parameters={"message": "Warning: Scam detected"},
                depends_on_step_ids=["step_1"],
                estimated_cost_usd=0.0300,
            ),
        ]
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_approved_tools)), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=mock_llm_output)):

        res = await planner_service.create_plan(
            AgentPlanRequest(task_prompt="Check +18005550199 and send alert", max_budget_usd=1.0)
        )
        assert res.is_achievable is True
        assert len(res.steps) == 2
        assert res.total_estimated_cost_usd == 0.0500
        assert res.total_estimated_cost_micro_dollars == 50000


@pytest.mark.asyncio
async def test_planner_rejects_circular_dependencies(mock_approved_tools):
    # Step 1 depends on Step 2, and Step 2 depends on Step 1 (Cycle)
    cyclic_output = LLMPlanOutput(
        is_achievable=True,
        plan_explanation="Cyclic plan",
        steps=[
            PlanStep(
                step_id="step_1",
                tool_id="tool-scam",
                tool_name="Scam Number Lookup",
                explanation="Step 1",
                input_parameters={"phone": "+18005550199"},
                depends_on_step_ids=["step_2"],
                estimated_cost_usd=0.02,
            ),
            PlanStep(
                step_id="step_2",
                tool_id="tool-sms",
                tool_name="SMS Sender",
                explanation="Step 2",
                input_parameters={"message": "alert"},
                depends_on_step_ids=["step_1"],
                estimated_cost_usd=0.03,
            ),
        ]
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_approved_tools)), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=cyclic_output)):

        with pytest.raises(PlanValidationError) as exc:
            await planner_service.create_plan(
                AgentPlanRequest(task_prompt="Impossible circular task")
            )
        assert "circular dependency" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_planner_rejects_unknown_tool_id(mock_approved_tools):
    hallucinated_output = LLMPlanOutput(
        is_achievable=True,
        plan_explanation="Plan with non-existent tool",
        steps=[
            PlanStep(
                step_id="step_1",
                tool_id="non-existent-tool-999",
                tool_name="Fake Tool",
                explanation="Fake",
                input_parameters={},
                estimated_cost_usd=0.01,
            )
        ]
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_approved_tools)), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=hallucinated_output)):

        with pytest.raises(PlanValidationError) as exc:
            await planner_service.create_plan(
                AgentPlanRequest(task_prompt="Use fake tool")
            )
        assert "unregistered" in str(exc.value).lower() or "unapproved" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_planner_budget_exceeded(mock_approved_tools):
    costly_output = LLMPlanOutput(
        is_achievable=True,
        plan_explanation="Costly plan",
        steps=[
            PlanStep(
                step_id="step_1",
                tool_id="tool-scam",
                tool_name="Scam Number Lookup",
                explanation="Check",
                input_parameters={"phone": "123"},
                estimated_cost_usd=0.02,
            )
        ]
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_approved_tools)), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=costly_output)):

        with pytest.raises(BudgetExceededError):
            # Budget set to 0.005, but tool is 0.020
            await planner_service.create_plan(
                AgentPlanRequest(task_prompt="Check", max_budget_usd=0.005)
            )
