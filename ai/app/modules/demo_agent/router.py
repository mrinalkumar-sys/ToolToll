from fastapi import APIRouter, Depends
from app.modules.demo_agent.schemas import DemoAgentRunRequest, DemoAgentRunResponse
from app.modules.demo_agent.service import demo_agent_service
from app.security.internal_auth import get_caller_identity, AuthenticatedCaller

router = APIRouter(prefix="/agent", tags=["Demo Agent Workflow"])


@router.post("/run", response_model=DemoAgentRunResponse)
async def run_demo_agent_workflow(
    request: DemoAgentRunRequest,
    caller: AuthenticatedCaller = Depends(get_caller_identity),
):
    """
    Executes a complete end-to-end autonomous agent workflow:
    Discovery -> Plan -> Paid Gateway Call -> Quality Judge -> Final Synthesis.
    """
    auth_headers = caller.to_forward_headers()
    return await demo_agent_service.run_workflow(request, auth_headers=auth_headers)
