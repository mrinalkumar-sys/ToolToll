from typing import List
from app.clients.llm_client import llm_client
from app.core.config import settings
from app.core.exceptions import LLMConfigurationError, SSRFSecurityError
from app.core.logging import logger
from app.security.input_safety import validate_endpoint_url_safety, sanitize_prompt_text
from app.modules.api_onboarding.prompts import ONBOARDING_SYSTEM_PROMPT, build_onboarding_prompt
from app.modules.api_onboarding.schemas import (
    OnboardingDraftRequest,
    OnboardingDraftResponse,
    StructuredToolDraft,
)


class ApiOnboardingService:
    async def generate_draft(self, request: OnboardingDraftRequest) -> OnboardingDraftResponse:
        """
        Extracts structured API tool metadata from raw documentation or specifications using Claude.
        Applies SSRF security scanning to the extracted endpoint URL.
        """
        if not llm_client.is_configured:
            raise LLMConfigurationError(
                "Claude LLM is not configured (missing ANTHROPIC_API_KEY). "
                "API onboarding extraction requires an active LLM provider."
            )

        sanitized_input = sanitize_prompt_text(request.raw_documentation, max_chars=15000)
        prompt = build_onboarding_prompt(sanitized_input)

        draft: StructuredToolDraft = await llm_client.generate_structured(
            schema_class=StructuredToolDraft,
            prompt=prompt,
            system_prompt=ONBOARDING_SYSTEM_PROMPT,
            model=settings.ANTHROPIC_MODEL,
            temperature=0.0,
        )

        # Validate URL safety and SSRF
        warnings: List[str] = []
        ssrf_passed = True
        try:
            full_url = f"{draft.base_url.rstrip('/')}{draft.endpoint_path}"
            validate_endpoint_url_safety(full_url)
        except SSRFSecurityError as e:
            ssrf_passed = False
            warning_msg = f"SSRF Security Violation detected in extracted URL: {e.message}"
            warnings.append(warning_msg)
            logger.warning(warning_msg)

        micro_dollars = int(round(draft.suggested_price_usd * settings.MICRO_DOLLARS_PER_USD))

        return OnboardingDraftResponse(
            draft=draft,
            price_micro_dollars=micro_dollars,
            security_check_passed=ssrf_passed,
            security_warnings=warnings,
            ready_for_review=ssrf_passed,
        )


api_onboarding_service = ApiOnboardingService()
