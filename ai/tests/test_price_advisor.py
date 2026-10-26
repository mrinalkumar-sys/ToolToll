from unittest.mock import AsyncMock, patch
import pytest

from app.clients.backend_client import BackendToolRecord
from app.modules.price_advisor.schemas import (
    PriceAdviceRequest,
    ClaudePriceOutput,
)
from app.modules.price_advisor.service import price_advisor_service


@pytest.fixture
def mock_comparable_tools():
    return [
        BackendToolRecord(
            id="t-1",
            name="Scam Caller Detector",
            category="security",
            short_desc="Checks phone numbers",
            base_url="https://api.test.com",
            price_per_call=0.0150,
            status="approved",
        ),
        BackendToolRecord(
            id="t-2",
            name="Fraud Email Lookup",
            category="security",
            short_desc="Checks email risk",
            base_url="https://api.test2.com",
            price_per_call=0.0250,
            status="approved",
        ),
    ]


@pytest.mark.asyncio
async def test_price_advisor_with_claude(mock_comparable_tools):
    mock_claude_output = ClaudePriceOutput(
        suggested_price_usd=0.0200,
        min_viable_price_usd=0.0120,
        max_viable_price_usd=0.0300,
        confidence=0.88,
        rationale="Competitive with existing fraud intelligence APIs.",
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_comparable_tools)), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=mock_claude_output)):

        res = await price_advisor_service.advise_pricing(
            PriceAdviceRequest(
                name="Fake Image Checker",
                category="security",
                description="Detects AI manipulated and deepfake images",
            )
        )
        assert res.suggested_price_usd == 0.0200
        assert res.suggested_price_micro_dollars == 20000
        assert res.confidence == 0.88
        assert res.comparable_tools_count == 2


@pytest.mark.asyncio
async def test_price_advisor_statistical_fallback(mock_comparable_tools):
    with patch("app.clients.llm_client.llm_client.is_configured", False), \
         patch("app.clients.backend_client.backend_client.list_approved_tools", AsyncMock(return_value=mock_comparable_tools)):

        res = await price_advisor_service.advise_pricing(
            PriceAdviceRequest(
                name="Phishing URL Scanner",
                category="security",
                description="Checks malicious URLs",
            )
        )
        assert res.suggested_price_usd == 0.0200  # Average of 0.0150 and 0.0250
        assert res.suggested_price_micro_dollars == 20000
        assert "marketplace listings" in res.rationale.lower()
