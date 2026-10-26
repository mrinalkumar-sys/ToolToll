from unittest.mock import AsyncMock, patch
import pytest

from app.clients.backend_client import BackendToolRecord, PaidCallExecutionResult
from app.modules.demo_agent.schemas import DemoAgentRunRequest
from app.modules.demo_agent.service import demo_agent_service
from app.modules.quality_judge.schemas import QualityJudgeResponse


@pytest.fixture
def mock_demo_tools():
    return [
        BackendToolRecord(
            id="tool-scam",
            name="Scam Number Lookup",
            category="security",
            short_desc="Checks fraudulent numbers",
            base_url="https://api.scam.org",
            price_per_call=0.0150,
            status="approved",
            input_schema={"type": "object", "properties": {"phone": {"type": "string"}}},
            total_calls=100,
            success_calls=98,
        )
    ]


@pytest.mark.asyncio
async def test_demo_agent_run_success(mock_demo_tools):
    mock_paid_result = PaidCallExecutionResult(
        call_id="call-abc-123",
        tool_id="tool-scam",
        tool_name="Scam Number Lookup",
        status="success",
        response_output={"is_scam": True, "confidence": 0.99, "threat": "IRS Impersonation"},
        duration_ms=85.0,
        price_charged=0.0150,
        quality_status="pass",
    )

    mock_judge = QualityJudgeResponse(
        call_id="call-abc-123",
        verdict="ok",
        reason="Real scam evidence detected",
        confidence=0.99,
        evaluation_stage="stage_2_claude",
        evaluation_status="completed",
        refund_recommended=False,
    )

    with patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_demo_tools)), \
         patch("app.clients.backend_client.backend_client.execute_paid_tool", AsyncMock(return_value=mock_paid_result)), \
         patch("app.modules.quality_judge.service.quality_judge_service.evaluate", AsyncMock(return_value=mock_judge)):

        res = await demo_agent_service.run_workflow(
            DemoAgentRunRequest(
                task_prompt="Check if caller +1-800-555-0199 is a scam",
                max_budget_usd=1.0,
            ),
            auth_headers={"X-Agent-Key": "test-agent-key"}
        )

        assert res.success is True
        assert len(res.executed_steps) == 1
        assert res.executed_steps[0].call_id == "call-abc-123"
        assert res.executed_steps[0].price_charged == 0.0150
        assert res.total_cost_micro_dollars == 15000
        assert res.gateway_verified is True
        assert res.executed_steps[0].quality_verdict == "ok"


@pytest.mark.asyncio
async def test_demo_agent_budget_cap_exceeded(mock_demo_tools):
    with patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_demo_tools)):
        res = await demo_agent_service.run_workflow(
            DemoAgentRunRequest(
                task_prompt="Check scam",
                max_budget_usd=0.0050,  # Below tool price of 0.0150
            ),
            auth_headers={"X-Agent-Key": "test-agent-key"}
        )
        assert res.success is False
        assert "budget" in res.final_summary.lower() or "no approved tools" in res.final_summary.lower()
        assert res.total_cost_usd == 0.0
