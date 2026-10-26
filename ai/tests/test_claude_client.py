from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from pydantic import BaseModel
from groq import AuthenticationError, RateLimitError
import httpx

from app.clients.llm_client import LLMClient
from app.core.exceptions import LLMConfigurationError, LLMProviderError


class DummyOutputSchema(BaseModel):
    summary: str
    score: float


@pytest.mark.asyncio
async def test_llm_unconfigured_raises_error():
    client = LLMClient(api_key=None, groq_api_key=None)
    with patch("app.core.config.settings.GROQ_API_KEY", None), patch("app.core.config.settings.ANTHROPIC_API_KEY", None):
        client.is_configured = False
        with pytest.raises(LLMConfigurationError):
            await client.generate_text("Hello")


@pytest.mark.asyncio
async def test_llm_authentication_error():
    client = LLMClient(groq_api_key="gsk_invalid_test_key")
    mock_chat = MagicMock()
    mock_chat.completions.create = AsyncMock(side_effect=AuthenticationError(
        message="Invalid Groq API Key",
        response=httpx.Response(401, request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")),
        body=None
    ))
    client._client.chat = mock_chat

    with pytest.raises(LLMConfigurationError) as exc:
        await client.generate_text("test")
    assert "authentication failed" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_llm_rate_limit_exceeded():
    client = LLMClient(groq_api_key="gsk_valid_looking_key")
    mock_chat = MagicMock()
    mock_chat.completions.create = AsyncMock(side_effect=RateLimitError(
        message="Rate limit exceeded",
        response=httpx.Response(429, request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")),
        body=None
    ))
    client._client.chat = mock_chat

    with patch("app.core.config.settings.GROQ_MAX_RETRIES", 1), patch("asyncio.sleep", AsyncMock()):
        with pytest.raises(LLMProviderError) as exc:
            await client.generate_text("test")
        assert "request failed" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_llm_invalid_json_structured_output():
    client = LLMClient(groq_api_key="gsk_test_key")
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content="NOT_VALID_JSON"))]
    client._client.chat.completions.create = AsyncMock(return_value=mock_resp)

    with pytest.raises(LLMProviderError) as exc:
        await client.generate_structured(DummyOutputSchema, "test prompt")
    assert "invalid json" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_llm_schema_mismatch_output():
    client = LLMClient(groq_api_key="gsk_test_key")
    # Missing required field 'score'
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content='{"summary": "ok"}'))]
    client._client.chat.completions.create = AsyncMock(return_value=mock_resp)

    with pytest.raises(LLMProviderError) as exc:
        await client.generate_structured(DummyOutputSchema, "test prompt")
    assert "did not match required schema" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_llm_successful_structured_output():
    client = LLMClient(groq_api_key="gsk_test_key")
    json_response = '{"summary": "Task complete", "score": 0.95}'
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content=json_response))]
    client._client.chat.completions.create = AsyncMock(return_value=mock_resp)

    res = await client.generate_structured(DummyOutputSchema, "test prompt")
    assert res.summary == "Task complete"
    assert res.score == 0.95
