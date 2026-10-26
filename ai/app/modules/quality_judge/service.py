import json
from typing import Any, Dict, Optional
from app.clients.llm_client import llm_client
from app.core.config import settings
from app.core.exceptions import LLMConfigurationError, LLMProviderError
from app.core.logging import logger
from app.modules.quality_judge.prompts import JUDGE_SYSTEM_PROMPT, build_judge_prompt
from app.modules.quality_judge.rules import run_stage1_deterministic_checks
from app.modules.quality_judge.schemas import (
    JudgeEvaluateRequest,
    QualityJudgeResponse,
    ClaudeJudgeOutput,
)


class QualityJudgeService:
    async def evaluate(self, request: JudgeEvaluateRequest) -> QualityJudgeResponse:
        """
        Two-stage quality judge:
        Stage 1: Deterministic rules (HTTP code, non-empty, latency, JSON Schema).
        Stage 2: Real Claude semantic verification (fail-open if Claude is unavailable).
        """
        # Stage 1: Deterministic checks
        passed, fail_reason = run_stage1_deterministic_checks(
            http_status=request.http_status,
            response_body=request.response_output,
            output_schema=request.output_schema,
            duration_ms=request.duration_ms,
        )

        if not passed:
            logger.info(f"Tool call {request.call_id or request.tool_id} failed Stage-1 rules: {fail_reason}")
            return QualityJudgeResponse(
                call_id=request.call_id,
                verdict="bad",
                reason=fail_reason or "Failed Stage-1 structural check",
                confidence=1.0,
                evaluation_stage="stage_1_rules",
                evaluation_status="completed",
                refund_recommended=True,
            )

        # Stage 2: Claude semantic evaluation
        if not llm_client.is_configured:
            # SRS NFR-10: Fail-open rule: If judge unavailable, default to OK
            logger.warning("Claude is unconfigured. Stage-2 judge failing open to OK.")
            return QualityJudgeResponse(
                call_id=request.call_id,
                verdict="ok",
                reason="Claude LLM unconfigured. Defaulted to OK via fail-open safety rule.",
                confidence=0.5,
                evaluation_stage="stage_2_claude",
                evaluation_status="skipped_fallback",
                refund_recommended=False,
            )

        try:
            req_input_str = (
                json.dumps(request.request_input)
                if isinstance(request.request_input, (dict, list))
                else str(request.request_input)
            )
            resp_output_str = (
                json.dumps(request.response_output)
                if isinstance(request.response_output, (dict, list))
                else str(request.response_output)
            )

            prompt = build_judge_prompt(
                tool_name=request.tool_name or "Tool",
                tool_description=request.tool_description or "General Purpose API",
                request_input=req_input_str,
                response_output=resp_output_str,
            )

            claude_output: ClaudeJudgeOutput = await llm_client.generate_structured(
                schema_class=ClaudeJudgeOutput,
                prompt=prompt,
                system_prompt=JUDGE_SYSTEM_PROMPT,
                model=settings.ANTHROPIC_FAST_MODEL,
                temperature=0.0,
            )

            is_ok = claude_output.verdict.strip().lower() == "ok"
            return QualityJudgeResponse(
                call_id=request.call_id,
                verdict="ok" if is_ok else "bad",
                reason=claude_output.reason,
                confidence=claude_output.confidence,
                evaluation_stage="stage_2_claude",
                evaluation_status="completed",
                refund_recommended=claude_output.refund_recommended,
            )

        except (LLMProviderError, LLMConfigurationError, Exception) as e:
            logger.error(f"Stage-2 Claude Judge error: {e}. Executing SRS fail-open fallback.")
            # SRS NFR-10: Judge failure defaults to "ok" so creators are not punished
            return QualityJudgeResponse(
                call_id=request.call_id,
                verdict="ok",
                reason=f"Judge transient failure ({type(e).__name__}). Defaulted to OK via SRS fail-open rule.",
                confidence=0.5,
                evaluation_stage="stage_2_claude",
                evaluation_status="skipped_fallback",
                refund_recommended=False,
            )


quality_judge_service = QualityJudgeService()
