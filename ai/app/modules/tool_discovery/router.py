from fastapi import APIRouter, Depends, status
from app.modules.tool_discovery.schemas import ToolDiscoveryRequest, ToolDiscoveryResponse
from app.modules.tool_discovery.service import discovery_service
from app.security.internal_auth import get_caller_identity, AuthenticatedCaller

router = APIRouter(prefix="/tools", tags=["Tool Discovery"])


@router.post("/discover", response_model=ToolDiscoveryResponse)
async def discover_tools_endpoint(
    request: ToolDiscoveryRequest,
    caller: AuthenticatedCaller = Depends(get_caller_identity),
):
    """
    Discovers approved tools from the ToolToll catalog matching a natural-language task.
    Combines semantic matching, permission filtering, and price constraints.
    """
    auth_headers = caller.to_forward_headers()
    return await discovery_service.discover_tools(request, auth_headers=auth_headers)
