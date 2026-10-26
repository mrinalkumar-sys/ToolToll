from fastapi import APIRouter, Depends
from app.modules.price_advisor.schemas import PriceAdviceRequest, PriceAdviceResponse
from app.modules.price_advisor.service import price_advisor_service
from app.security.internal_auth import get_caller_identity, AuthenticatedCaller

router = APIRouter(prefix="/advisor", tags=["Price Advisor"])


@router.post("/suggest-price", response_model=PriceAdviceResponse)
async def suggest_tool_price(
    request: PriceAdviceRequest,
    caller: AuthenticatedCaller = Depends(get_caller_identity),
):
    """
    Analyzes API functionality and current marketplace benchmarks to recommend per-call pricing.
    """
    auth_headers = caller.to_forward_headers()
    return await price_advisor_service.advise_pricing(request, auth_headers=auth_headers)
