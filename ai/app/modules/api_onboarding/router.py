from fastapi import APIRouter, Depends
from app.modules.api_onboarding.schemas import OnboardingDraftRequest, OnboardingDraftResponse
from app.modules.api_onboarding.service import api_onboarding_service
from app.security.internal_auth import get_caller_identity, AuthenticatedCaller

router = APIRouter(prefix="/onboarding", tags=["API Onboarding"])


@router.post("/draft", response_model=OnboardingDraftResponse)
async def create_onboarding_draft(
    request: OnboardingDraftRequest,
    caller: AuthenticatedCaller = Depends(get_caller_identity),
):
    """
    Parses unstructured API docs or OpenAPI specs into a structured tool listing draft.
    Runs SSRF validation to prevent internal network scanning.
    """
    return await api_onboarding_service.generate_draft(request)
