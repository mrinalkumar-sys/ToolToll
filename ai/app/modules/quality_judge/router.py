from fastapi import APIRouter, Depends
from app.modules.quality_judge.schemas import JudgeEvaluateRequest, QualityJudgeResponse
from app.modules.quality_judge.service import quality_judge_service
from app.security.internal_auth import get_caller_identity, AuthenticatedCaller

router = APIRouter(prefix="/judge", tags=["Quality Judge"])


@router.post("/evaluate", response_model=QualityJudgeResponse)
async def evaluate_tool_call(
    request: JudgeEvaluateRequest,
    caller: AuthenticatedCaller = Depends(get_caller_identity),
):
    """
    Evaluates tool call output via two stages:
    Stage 1: deterministic structural/HTTP/latency checks.
    Stage 2: Claude semantic evaluation with fail-open fallback.
    """
    return await quality_judge_service.evaluate(request)
