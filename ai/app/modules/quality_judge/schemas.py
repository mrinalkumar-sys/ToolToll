from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class JudgeEvaluateRequest(BaseModel):
    call_id: Optional[str] = None
    tool_id: str
    tool_name: Optional[str] = "Unknown Tool"
    tool_description: Optional[str] = ""
    request_input: Any
    response_output: Any
    http_status: Optional[int] = 200
    duration_ms: float = 0.0
    output_schema: Optional[Dict[str, Any]] = None


class ClaudeJudgeOutput(BaseModel):
    verdict: str = Field(description="'ok' if response is satisfactory, 'bad' if garbage/wrong")
    reason: str = Field(description="Explanation of the verdict")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in judgment")
    refund_recommended: bool = Field(description="True if caller should be refunded")


class QualityJudgeResponse(BaseModel):
    call_id: Optional[str] = None
    verdict: str = Field(description="'ok' or 'bad'")
    reason: str
    confidence: float
    evaluation_stage: str = Field(description="'stage_1_rules' or 'stage_2_claude'")
    evaluation_status: str = Field(description="'completed' or 'skipped_fallback'")
    refund_recommended: bool
