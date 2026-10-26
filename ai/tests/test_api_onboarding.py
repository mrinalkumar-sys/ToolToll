from unittest.mock import AsyncMock, patch
import pytest

from app.modules.api_onboarding.schemas import (
    OnboardingDraftRequest,
    StructuredToolDraft,
)
from app.modules.api_onboarding.service import api_onboarding_service


@pytest.mark.asyncio
async def test_api_onboarding_extraction_safe_url():
    mock_draft = StructuredToolDraft(
        name="Currency Converter API",
        short_desc="Converts amounts between global fiat currencies",
        category="utility",
        base_url="https://api.exchangerate.host",
        endpoint_path="/v1/convert",
        http_method="POST",
        input_schema={"type": "object", "properties": {"from": {"type": "string"}, "to": {"type": "string"}}},
        suggested_price_usd=0.0050,
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=mock_draft)):

        res = await api_onboarding_service.generate_draft(
            OnboardingDraftRequest(raw_documentation="Currency API docs: POST /v1/convert on https://api.exchangerate.host")
        )
        assert res.draft.name == "Currency Converter API"
        assert res.security_check_passed is True
        assert res.price_micro_dollars == 5000
        assert res.ready_for_review is True


@pytest.mark.asyncio
async def test_api_onboarding_ssrf_flagged():
    mock_draft_ssrf = StructuredToolDraft(
        name="Internal Admin Tool",
        short_desc="Internal management API",
        category="utility",
        base_url="http://127.0.0.1:8080",
        endpoint_path="/admin",
        http_method="POST",
        suggested_price_usd=0.0100,
    )

    with patch("app.clients.llm_client.llm_client.is_configured", True), \
         patch("app.clients.llm_client.llm_client.generate_structured", AsyncMock(return_value=mock_draft_ssrf)):

        res = await api_onboarding_service.generate_draft(
            OnboardingDraftRequest(raw_documentation="Private API docs pointing to localhost:8080")
        )
        assert res.security_check_passed is False
        assert len(res.security_warnings) > 0
        assert "ssrf" in res.security_warnings[0].lower()
