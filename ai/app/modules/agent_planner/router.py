from fastapi import APIRouter, Depends
from app.modules.agent_planner.schemas import AgentPlanRequest, AgentPlanResponse
from app.modules.agent_planner.service import planner_service
from app.security.internal_auth import get_caller_identity, AuthenticatedCaller

router = APIRouter(prefix="/agent", tags=["Agent Planner"])


@router.post("/plan", response_model=AgentPlanResponse)
async def plan_task_endpoint(
    request: AgentPlanRequest,
    caller: AuthenticatedCaller = Depends(get_caller_identity),
):
    """
    Generates a minimal, validated execution plan using Claude.
    Verifies tool IDs against approved catalog, checks parameter schemas,
    and prevents circular dependencies.
    """
    auth_headers = caller.to_forward_headers()
    return await planner_service.create_plan(request, auth_headers=auth_headers)
