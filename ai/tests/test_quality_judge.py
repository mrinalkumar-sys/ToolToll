from unittest.mock import AsyncMock, patch
import pytest

from app.modules.quality_judge.schemas import (
    JudgeEvaluateRequest,
    ClaudeJudgeOutput,
)
from app.modules.quality_judge.service import quality_judge_service


@pytest.mark.asyncio
async def test_quality_judge_stage1_http_500_refund():
    req = JudgeEvaluateRequest(
        tool_id="tool-1",
        request_input={"query": "test"},
        response_output=None,
        http_status=500,
    )
    res = await quality_judge_service.evaluate(req)
    assert res.verdict == "bad"
    assert res.refund_recommended is True
    assert res.evaluation_stage == "stage_1_rules"


@pytest.mark.asyncio
async def test_quality_judge_stage1_empty_output_refund():
    req = JudgeEvaluateRequest(
        tool_id="tool-1",
        request_input={"query": "test"},
        response_output="",
        http_status=200,
    )
    res = await quality_judge_service.evaluate(req)
    assert res.verdict == "bad"
    assert res.refund_recommended is True
    assert "empty" in res.reason.lower()


@pytest.mark.asyncio
async def test_quality_judge_stage1_schema_violation_refund():
    req = JudgeEvaluateRequest(
        tool_id="tool-1",
        request_input={"query": "test"},
        response_output={"status": 123},  # expected string
        http_status=200,
        output_schema={
            "type": "object",
            "properties": {"status": {"type": "string"}},
            "required": ["status"],
        },
    )
    res = await quality_judge_service.evaluate(req)
    assert res.verdict == "bad"
    assert res.refund_recommended is True
    assert "schema" in res.reason.lower()


@pytest.mark.asyncio
async def test_quality_judge_stage2_claude_verdict_bad():
    req = JudgeEvaluateRequest(
        tool_id="tool-1",
        tool_name="Scam Caller Detector",
        request_input={"phone": "+18005550199"},
        response_output={"result": "Lorem ipsum dolor sit amet placeholder text"},
        http_status=200,
    )
    mock_claude_eval = ClaudeJudgeOutput(
        verdict="bad",
        reason="Output contains meaningless placeholder text instead of real scam evaluation",
        confidence=0.98,
        refund_recommended=True,
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=mock_claude_eval)):

        res = await quality_judge_service.evaluate(req)
        assert res.verdict == "bad"
        assert res.refund_recommended is True
        assert res.evaluation_stage == "stage_2_claude"
        assert res.evaluation_status == "completed"


@pytest.mark.asyncio
async def test_quality_judge_fail_open_when_claude_unavailable():
    # Per SRS NFR-10: "a judge failure defaults to 'ok' so creators are not punished"
    req = JudgeEvaluateRequest(
        tool_id="tool-1",
        request_input={"query": "test"},
        response_output={"data": "valid format"},
        http_status=200,
    )

    with patch("app.clients.llm_client.llm_client.is_configured", False):
        res = await quality_judge_service.evaluate(req)
        assert res.verdict == "ok"
        assert res.refund_recommended is False
        assert res.evaluation_status == "skipped_fallback"
