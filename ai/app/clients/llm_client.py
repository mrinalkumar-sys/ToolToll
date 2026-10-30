import asyncio
import json
import random
import time
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

import groq
from groq import AsyncGroq, APIStatusError, RateLimitError, APIConnectionError, AuthenticationError

from app.core.config import settings
from app.core.exceptions import LLMConfigurationError, LLMProviderError
from app.core.logging import logger

T = TypeVar("T", bound=BaseModel)


class LLMClient:
    """
    Universal LLM Async Client with primary native support for Groq (Llama-3.3-70b / Llama-3.1-8b)
    and optional Anthropic Claude support.
    Executes real inference, enforces timeouts, retries transient errors safely,
    and parses structured JSON responses into validated Pydantic models.
    """
    def __init__(self, api_key: Optional[str] = None, groq_api_key: Optional[str] = None):
        self._groq_key = groq_api_key or api_key or settings.GROQ_API_KEY
        self.provider = "groq"

        if self._groq_key:
            self._client = AsyncGroq(
                api_key=self._groq_key,
                timeout=settings.GROQ_TIMEOUT_SECONDS,
            )
            self.is_configured = True
        elif settings.ANTHROPIC_API_KEY:
            # Fallback to Anthropic if configured
            try:
                import anthropic
                self._anthropic_client = anthropic.AsyncAnthropic(
                    api_key=settings.ANTHROPIC_API_KEY,
                    timeout=settings.ANTHROPIC_TIMEOUT_SECONDS,
                )
                self.provider = "anthropic"
                self.is_configured = True
            except Exception:
                self.is_configured = False
        else:
            self._client = None
            self.is_configured = False

    def _ensure_configured(self) -> AsyncGroq:
        if not self.is_configured or self._client is None:
            raise LLMConfigurationError(
                "LLM provider is not configured. "
                "Set GROQ_API_KEY in the environment or .env file."
            )
        return self._client

    async def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
    ) -> str:
        """
        Generates text response from Groq.
        """
        client = self._ensure_configured()
        if self.provider == "groq":
            if model and not model.startswith("claude"):
                target_model = model
            elif model and ("haiku" in model.lower() or "fast" in str(model).lower()):
                target_model = settings.GROQ_FAST_MODEL
            else:
                target_model = settings.GROQ_MODEL
        else:
            target_model = model or settings.ANTHROPIC_MODEL

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        start_time = time.perf_counter()
        retries = 0
        max_retries = settings.GROQ_MAX_RETRIES

        while True:
            try:
                logger.debug(f"Calling Groq model={target_model} (attempt {retries + 1})")
                response = await client.chat.completions.create(
                    model=target_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                duration = time.perf_counter() - start_time
                content_text = response.choices[0].message.content or ""

                logger.info(
                    "Groq generation complete",
                    extra={
                        "extra_data": {
                            "model": target_model,
                            "tokens_input": response.usage.prompt_tokens if response.usage else 0,
                            "tokens_output": response.usage.completion_tokens if response.usage else 0,
                            "duration_ms": round(duration * 1000, 2),
                        }
                    }
                )
                return content_text

            except AuthenticationError as e:
                logger.error(f"Groq authentication failed: {e}")
                raise LLMConfigurationError(f"Groq authentication failed: {e}")

            except (RateLimitError, APIConnectionError, APIStatusError) as e:
                retries += 1
                if retries > max_retries:
                    logger.error(f"Groq request failed after {max_retries} retries: {e}")
                    raise LLMProviderError(f"Groq API request failed: {e}")

                sleep_time = (2 ** retries) + random.uniform(0.1, 0.5)
                logger.warning(f"Groq transient error ({type(e).__name__}). Retrying in {sleep_time:.2f}s...")
                await asyncio.sleep(sleep_time)

            except Exception as e:
                logger.error(f"Unexpected Groq client error: {e}")
                raise LLMProviderError(f"Unexpected error communicating with Groq: {e}")

    async def generate_structured(
        self,
        schema_class: Type[T],
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> T:
        """
        Instructs Groq to output strictly compliant JSON matching the provided Pydantic schema,
        using Groq's json_object response format.
        """
        client = self._ensure_configured()
        if self.provider == "groq":
            if model and not model.startswith("claude"):
                target_model = model
            elif model and ("haiku" in model.lower() or "fast" in str(model).lower()):
                target_model = settings.GROQ_FAST_MODEL
            else:
                target_model = settings.GROQ_MODEL
        else:
            target_model = model or settings.ANTHROPIC_MODEL
        json_schema = json.dumps(schema_class.model_json_schema(), indent=2)

        system_instruction = (
            f"{system_prompt or 'You are an expert AI agent assistant.'}\n\n"
            f"CRITICAL: You must respond ONLY with a single valid JSON object strictly matching this JSON Schema:\n"
            f"{json_schema}\n"
            f"Do not include any introductory remarks, markdown code block backticks (like ```json), or explanatory notes. "
            f"Return ONLY the pure JSON object."
        )

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt},
        ]

        start_time = time.perf_counter()
        retries = 0
        max_retries = settings.GROQ_MAX_RETRIES

        while True:
            try:
                response = await client.chat.completions.create(
                    model=target_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"},
                )
                raw_response = response.choices[0].message.content or ""
                break

            except AuthenticationError as e:
                raise LLMConfigurationError(f"Groq authentication failed: {e}")

            except (RateLimitError, APIConnectionError, APIStatusError) as e:
                retries += 1
                if retries > max_retries:
                    raise LLMProviderError(f"Groq API structured call failed: {e}")
                await asyncio.sleep(2 ** retries)

            except Exception as e:
                raise LLMProviderError(f"Unexpected error communicating with Groq: {e}")

        cleaned = raw_response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed_dict = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode Groq output as JSON: {cleaned[:300]}...")
            raise LLMProviderError(f"Groq returned invalid JSON syntax: {e}")

        try:
            validated = schema_class.model_validate(parsed_dict)
            return validated
        except ValidationError as e:
            logger.error(f"Structured response failed Pydantic validation: {e}")
            raise LLMProviderError(f"Groq response did not match required schema: {e}")


# Global singleton instance
llm_client = LLMClient()
ClaudeClient = LLMClient  # Alias for backward compatibility
