import uuid
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import (
    BackendConnectionError,
    InsufficientFundsError,
    SpendingLimitExceededError,
    ToolNotFoundError,
    UnauthorizedAgentException,
    GatewayExecutionError,
)
from app.core.logging import logger


class BackendToolRecord(BaseModel):
    id: str
    creator_id: Optional[str] = None
    name: str
    slug: Optional[str] = None
    short_desc: str
    detailed_desc: Optional[str] = None
    category: str
    tags: List[str] = []
    base_url: str
    endpoint_path: str = "/"
    http_method: str = "POST"
    input_schema: Dict[str, Any] = {}
    output_schema: Optional[Dict[str, Any]] = None
    price_per_call: float = 0.0100
    currency: str = "USD"
    timeout_seconds: int = 15
    rate_limit_per_minute: int = 60
    status: str = "approved"
    total_calls: int = 0
    success_calls: int = 0
    average_latency_ms: float = 0.0


class PaidCallExecutionResult(BaseModel):
    call_id: str
    tool_id: str
    tool_name: str
    status: str
    response_output: Optional[Any] = None
    duration_ms: float = 0.0
    price_charged: float = 0.0
    quality_status: str = "pass"
    reversal_reason: Optional[str] = None


class ToolTollBackendClient:
    """
    HTTPX-based client for interacting with the main ToolToll backend service.
    Handles tool discovery queries, authenticated gateway calls, and wallet queries.
    """
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.BACKEND_BASE_URL).rstrip("/")
        self.timeout = httpx.Timeout(settings.BACKEND_TIMEOUT_SECONDS, connect=5.0)

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)

    async def check_health(self) -> Dict[str, Any]:
        """Checks if the main backend is alive."""
        try:
            async with self._get_client() as client:
                res = await client.get("/api/health")
                if res.status_code == 200:
                    return {"status": "reachable", "details": res.json()}
                return {"status": "unhealthy", "code": res.status_code}
        except Exception as e:
            logger.warning(f"Backend health check failed: {e}")
            return {"status": "unreachable", "error": str(e)}

    async def list_approved_tools(
        self,
        category: Optional[str] = None,
        auth_headers: Optional[Dict[str, str]] = None
    ) -> List[BackendToolRecord]:
        """
        Retrieves active approved tools from the backend catalog.
        """
        params = {}
        if category:
            params["category"] = category

        headers = auth_headers or {}
        try:
            async with self._get_client() as client:
                res = await client.get("/api/tools", params=params, headers=headers)
                if res.status_code == 200:
                    raw_list = res.json()
                    return [BackendToolRecord.model_validate(item) for item in raw_list]
                elif res.status_code == 401:
                    raise UnauthorizedAgentException("Backend rejected authentication when fetching tools")
                else:
                    logger.error(f"Failed to list tools from backend: HTTP {res.status_code} {res.text}")
                    raise BackendConnectionError(f"Backend returned HTTP {res.status_code}: {res.text}")
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Cannot reach main backend at {self.base_url}: {e}")
            raise BackendConnectionError(f"Cannot connect to main backend at {self.base_url}: {e}")

    async def search_tools(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        max_price: Optional[float] = None,
        limit: int = 50,
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> List[BackendToolRecord]:
        """
        Queries marketplace tools with optional text, category, and price filters.
        """
        params: Dict[str, Any] = {"limit": limit}
        if query:
            params["q"] = query
        if category:
            params["category"] = category
        if max_price is not None:
            params["max_price"] = max_price

        headers = auth_headers or {}
        try:
            async with self._get_client() as client:
                res = await client.get("/api/tools/search", params=params, headers=headers)
                if res.status_code == 200:
                    return [BackendToolRecord.model_validate(item) for item in res.json()]
                elif res.status_code == 404:
                    # Fallback to list_approved_tools if search route is not enabled
                    return await self.list_approved_tools(category=category, auth_headers=auth_headers)
                elif res.status_code == 401:
                    raise UnauthorizedAgentException("Backend authentication failed")
                else:
                    raise BackendConnectionError(f"Backend search returned HTTP {res.status_code}")
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise BackendConnectionError(f"Backend connection failed during tool search: {e}")

    async def get_tool_by_id(
        self,
        tool_id: str,
        auth_headers: Optional[Dict[str, str]] = None
    ) -> BackendToolRecord:
        """
        Retrieves full details of a specific tool by ID.
        """
        headers = auth_headers or {}
        try:
            async with self._get_client() as client:
                res = await client.get(f"/api/tools/{tool_id}", headers=headers)
                if res.status_code == 200:
                    return BackendToolRecord.model_validate(res.json())
                elif res.status_code == 404:
                    raise ToolNotFoundError(f"Tool with ID '{tool_id}' not found in active catalog.")
                elif res.status_code == 401:
                    raise UnauthorizedAgentException("Unauthorized to access tool metadata")
                else:
                    raise BackendConnectionError(f"Backend returned HTTP {res.status_code}")
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise BackendConnectionError(f"Backend connection failed fetching tool {tool_id}: {e}")

    async def execute_paid_tool(
        self,
        tool_id: str,
        input_data: Dict[str, Any],
        idempotency_key: Optional[str] = None,
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> PaidCallExecutionResult:
        """
        Calls a paid tool strictly through the main ToolToll authenticated gateway.
        Enforces idempotency, preserves exact upstream errors, and handles HTTP 402/403/502.
        """
        key = idempotency_key or f"idem_{uuid.uuid4().hex}"
        payload = {
            "tool_id": tool_id,
            "input_data": input_data,
            "idempotency_key": key,
        }

        headers = dict(auth_headers or {})
        if not headers.get("X-Agent-Key") and not headers.get("Authorization"):
            raise UnauthorizedAgentException("Missing required agent or user authentication for paid call")

        # Ensure idempotency header is also set
        headers["Idempotency-Key"] = key

        # Note: We try primary gateway route /api/tools/{tool_id}/calls then fallback to /v1/call/{tool_id}
        endpoint = f"/api/tools/{tool_id}/calls"

        try:
            async with self._get_client() as client:
                res = await client.post(endpoint, json=payload, headers=headers)

                if res.status_code == 200:
                    data = res.json()
                    return PaidCallExecutionResult(
                        call_id=data.get("call_id", ""),
                        tool_id=data.get("tool_id", tool_id),
                        tool_name=data.get("tool_name", "Tool"),
                        status=data.get("status", "success"),
                        response_output=data.get("response_output") or data.get("output"),
                        duration_ms=float(data.get("duration_ms", 0.0)),
                        price_charged=float(data.get("price_charged", 0.0)),
                        quality_status=data.get("quality_status", "pass"),
                        reversal_reason=data.get("reversal_reason"),
                    )

                elif res.status_code == 401:
                    raise UnauthorizedAgentException(f"Agent unauthorized: {res.text}")

                elif res.status_code == 402:
                    raise InsufficientFundsError(
                        f"Payment Required: Agent wallet has insufficient funds. Detail: {res.text}"
                    )

                elif res.status_code == 403:
                    raise SpendingLimitExceededError(
                        f"Spending limit exceeded: Daily or per-call limit prevented execution. Detail: {res.text}"
                    )

                elif res.status_code == 404:
                    raise ToolNotFoundError(f"Tool '{tool_id}' not found or inactive in gateway: {res.text}")

                elif res.status_code == 502:
                    # SRS Rule: 502 means upstream tool failed and call was automatically refunded
                    error_detail = res.text
                    logger.warning(f"Tool {tool_id} returned HTTP 502 (Upstream failure/refunded): {error_detail}")
                    return PaidCallExecutionResult(
                        call_id=f"err_{key}",
                        tool_id=tool_id,
                        tool_name="Tool",
                        status="reversed",
                        response_output=None,
                        duration_ms=0.0,
                        price_charged=0.0,
                        quality_status="fail",
                        reversal_reason=f"Tool failed or timed out: {error_detail}",
                    )
                else:
                    raise GatewayExecutionError(
                        f"Gateway returned unexpected HTTP {res.status_code}: {res.text}"
                    )

        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Gateway connection error for tool {tool_id}: {e}")
            raise BackendConnectionError(f"Gateway connection failure: {e}")

    async def get_wallet_balance(
        self,
        auth_headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Retrieves current wallet balance from the backend.
        """
        headers = auth_headers or {}
        try:
            async with self._get_client() as client:
                res = await client.get("/api/wallet/me", headers=headers)
                if res.status_code == 200:
                    return res.json()
                elif res.status_code == 401:
                    raise UnauthorizedAgentException("Unauthorized to view wallet balance")
                else:
                    raise BackendConnectionError(f"Failed to fetch wallet: HTTP {res.status_code}")
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise BackendConnectionError(f"Cannot reach backend wallet endpoint: {e}")

    async def create_tool_draft(
        self,
        tool_data: Dict[str, Any],
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Submits an onboarded tool draft to the main backend catalog.
        """
        headers = auth_headers or {}
        try:
            async with self._get_client() as client:
                res = await client.post("/api/tools", json=tool_data, headers=headers)
                if res.status_code in (200, 201):
                    return res.json()
                elif res.status_code == 401:
                    raise UnauthorizedAgentException("Creator authentication required to register tool")
                else:
                    raise BackendConnectionError(f"Backend tool creation failed: HTTP {res.status_code} {res.text}")
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise BackendConnectionError(f"Cannot reach backend tool registration: {e}")


# Global singleton instance
backend_client = ToolTollBackendClient()
