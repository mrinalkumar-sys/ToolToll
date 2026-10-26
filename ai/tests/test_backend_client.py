from unittest.mock import AsyncMock, patch
import pytest
import httpx

from app.clients.backend_client import ToolTollBackendClient, BackendToolRecord
from app.core.exceptions import (
    BackendConnectionError,
    InsufficientFundsError,
    SpendingLimitExceededError,
    ToolNotFoundError,
    UnauthorizedAgentException,
)


@pytest.mark.asyncio
async def test_backend_client_list_approved_tools():
    client = ToolTollBackendClient("http://mock-backend:8000")
    sample_tools = [
        {
            "id": "tool-1",
            "name": "Scam Number Checker",
            "short_desc": "Checks if telephone number is reported as a scam",
            "category": "security",
            "base_url": "https://api.scamcheck.io",
            "endpoint_path": "/v1/check",
            "price_per_call": 0.0150,
            "status": "approved",
            "total_calls": 100,
            "success_calls": 98,
        }
    ]

    mock_resp = httpx.Response(200, json=sample_tools, request=httpx.Request("GET", "http://mock-backend:8000/api/tools"))
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_resp)):
        tools = await client.list_approved_tools()
        assert len(tools) == 1
        assert tools[0].name == "Scam Number Checker"
        assert tools[0].price_per_call == 0.0150


@pytest.mark.asyncio
async def test_backend_client_execute_paid_tool_success():
    client = ToolTollBackendClient("http://mock-backend:8000")
    success_payload = {
        "call_id": "call-12345",
        "tool_id": "tool-1",
        "tool_name": "Scam Number Checker",
        "status": "success",
        "response_output": {"is_scam": False, "risk_score": 0.05},
        "duration_ms": 112.5,
        "price_charged": 0.0150,
        "quality_status": "pass",
    }
    mock_resp = httpx.Response(200, json=success_payload, request=httpx.Request("POST", "http://mock-backend:8000/api/tools/tool-1/calls"))

    with patch.object(httpx.AsyncClient, "post", AsyncMock(return_value=mock_resp)):
        result = await client.execute_paid_tool(
            tool_id="tool-1",
            input_data={"phone": "+18005550199"},
            auth_headers={"X-Agent-Key": "valid-agent-key"}
        )
        assert result.call_id == "call-12345"
        assert result.status == "success"
        assert result.price_charged == 0.0150
        assert result.response_output["risk_score"] == 0.05


@pytest.mark.asyncio
async def test_backend_client_execute_paid_tool_insufficient_funds_402():
    client = ToolTollBackendClient("http://mock-backend:8000")
    mock_resp = httpx.Response(402, text="Insufficient wallet balance", request=httpx.Request("POST", "http://mock-backend:8000/api/tools/tool-1/calls"))

    with patch.object(httpx.AsyncClient, "post", AsyncMock(return_value=mock_resp)):
        with pytest.raises(InsufficientFundsError):
            await client.execute_paid_tool(
                tool_id="tool-1",
                input_data={"phone": "+18005550199"},
                auth_headers={"X-Agent-Key": "valid-agent-key"}
            )


@pytest.mark.asyncio
async def test_backend_client_execute_paid_tool_spending_limit_403():
    client = ToolTollBackendClient("http://mock-backend:8000")
    mock_resp = httpx.Response(403, text="Daily spending limit reached", request=httpx.Request("POST", "http://mock-backend:8000/api/tools/tool-1/calls"))

    with patch.object(httpx.AsyncClient, "post", AsyncMock(return_value=mock_resp)):
        with pytest.raises(SpendingLimitExceededError):
            await client.execute_paid_tool(
                tool_id="tool-1",
                input_data={"phone": "+18005550199"},
                auth_headers={"X-Agent-Key": "valid-agent-key"}
            )


@pytest.mark.asyncio
async def test_backend_client_execute_paid_tool_upstream_502_refunded():
    client = ToolTollBackendClient("http://mock-backend:8000")
    mock_resp = httpx.Response(502, text="Upstream gateway timeout; refunded", request=httpx.Request("POST", "http://mock-backend:8000/api/tools/tool-1/calls"))

    with patch.object(httpx.AsyncClient, "post", AsyncMock(return_value=mock_resp)):
        result = await client.execute_paid_tool(
            tool_id="tool-1",
            input_data={"phone": "+18005550199"},
            auth_headers={"X-Agent-Key": "valid-agent-key"}
        )
        assert result.status == "reversed"
        assert result.price_charged == 0.0
        assert "refunded" in result.reversal_reason.lower() or "failed" in result.reversal_reason.lower()
