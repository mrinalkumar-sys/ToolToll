from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient

from app.clients.backend_client import BackendToolRecord
from app.modules.tool_discovery.schemas import ToolDiscoveryRequest
from app.modules.tool_discovery.service import discovery_service


@pytest.fixture
def mock_tools():
    return [
        BackendToolRecord(
            id="tool-scam",
            name="Scam Caller Detector",
            category="security",
            short_desc="Identifies fraudulent phone numbers and spam caller risks",
            base_url="https://api.scamdetector.com",
            price_per_call=0.0150,
            status="approved",
            total_calls=100,
            success_calls=99,
        ),
        BackendToolRecord(
            id="tool-translate",
            name="Hindi English Translator",
            category="nlp",
            short_desc="Accurately translates Hindi and English sentences",
            base_url="https://api.translate.com",
            price_per_call=0.0200,
            status="approved",
            total_calls=50,
            success_calls=50,
        ),
        BackendToolRecord(
            id="tool-inactive",
            name="Inactive Tool",
            category="utility",
            short_desc="Should never be shown",
            base_url="https://api.inactive.com",
            price_per_call=0.0100,
            status="pending",
        ),
    ]


@pytest.mark.asyncio
async def test_tool_discovery_ranking(mock_tools):
    with patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_tools)):
        res = await discovery_service.discover_tools(
            ToolDiscoveryRequest(task_prompt="Check scam telephone number")
        )
        assert res.total_candidates == 2  # Inactive tool must be excluded
        assert len(res.matches) == 2
        assert res.matches[0].tool_id == "tool-scam"
        assert res.matches[0].relevance_score > 0.0


@pytest.mark.asyncio
async def test_tool_discovery_permission_filtering(mock_tools):
    with patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_tools)):
        res = await discovery_service.discover_tools(
            ToolDiscoveryRequest(
                task_prompt="Translate text to Hindi",
                allowed_tool_ids=["tool-translate"]  # Whitelist permits only translate
            )
        )
        assert res.total_candidates == 1
        assert res.matches[0].tool_id == "tool-translate"


@pytest.mark.asyncio
async def test_tool_discovery_price_filter(mock_tools):
    with patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_tools)):
        res = await discovery_service.discover_tools(
            ToolDiscoveryRequest(
                task_prompt="Telephone verification",
                max_price=0.0100  # Scam checker is $0.0150, so should be filtered out
            )
        )
        assert res.total_candidates == 0
        assert len(res.matches) == 0


@pytest.mark.asyncio
async def test_discover_tools_endpoint(async_client: AsyncClient, mock_tools):
    with patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_tools)):
        response = await async_client.post(
            "/api/v1/tools/discover",
            json={"task_prompt": "Scam caller verification"},
            headers={"X-Agent-Key": "test-agent-key"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["matches"][0]["tool_id"] == "tool-scam"
