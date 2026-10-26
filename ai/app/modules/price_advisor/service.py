from typing import Dict, List, Optional
from app.clients.backend_client import backend_client, BackendToolRecord
from app.clients.llm_client import llm_client
from app.core.config import settings
from app.core.logging import logger
from app.modules.price_advisor.prompts import PRICE_ADVISOR_SYSTEM_PROMPT, build_price_advisor_prompt
from app.modules.price_advisor.schemas import (
    PriceAdviceRequest,
    PriceAdviceResponse,
    ClaudePriceOutput,
)


class PriceAdvisorService:
    async def advise_pricing(
        self,
        request: PriceAdviceRequest,
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> PriceAdviceResponse:
        # Step 1: Query actual catalog for comparable tools
        tools: List[BackendToolRecord] = await backend_client.list_approved_tools(
            category=request.category,
            auth_headers=auth_headers
        )

        # Fallback to general catalog if category has no tools
        if not tools:
            tools = await backend_client.list_approved_tools(auth_headers=auth_headers)

        if tools:
            prices = [t.price_per_call for t in tools if t.price_per_call > 0]
            avg_price = sum(prices) / max(len(prices), 1)
            min_price = min(prices) if prices else 0.005
            max_price = max(prices) if prices else 0.050
            comparable_summary = "\n".join(
                f"- {t.name} ({t.category}): ${t.price_per_call:.4f} USD - {t.short_desc[:60]}"
                for t in tools[:8]
            )
        else:
            avg_price = 0.010
            min_price = 0.001
            max_price = 0.050
            comparable_summary = "No comparable tools currently active in the marketplace."

        # Step 2: Use Claude if configured
        if llm_client.is_configured:
            prompt = build_price_advisor_prompt(
                name=request.name,
                category=request.category,
                description=request.description,
                comparable_tools_summary=comparable_summary,
                market_average_usd=avg_price,
                market_min_usd=min_price,
                market_max_usd=max_price,
            )

            try:
                claude_res: ClaudePriceOutput = await llm_client.generate_structured(
                    schema_class=ClaudePriceOutput,
                    prompt=prompt,
                    system_prompt=PRICE_ADVISOR_SYSTEM_PROMPT,
                    model=settings.ANTHROPIC_FAST_MODEL,
                    temperature=0.1,
                )

                suggested_usd = round(claude_res.suggested_price_usd, 4)
                micro_dollars = int(round(suggested_usd * settings.MICRO_DOLLARS_PER_USD))

                return PriceAdviceResponse(
                    tool_name=request.name,
                    category=request.category,
                    suggested_price_usd=suggested_usd,
                    suggested_price_micro_dollars=micro_dollars,
                    min_viable_price_usd=round(claude_res.min_viable_price_usd, 4),
                    max_viable_price_usd=round(claude_res.max_viable_price_usd, 4),
                    confidence=claude_res.confidence,
                    rationale=claude_res.rationale,
                    comparable_tools_count=len(tools),
                    market_average_usd=round(avg_price, 4),
                )
            except Exception as e:
                logger.warning(f"Claude pricing advice failed: {e}. Falling back to marketplace statistics.")

        # Deterministic statistical calculation if Claude is unavailable
        suggested_usd = round(avg_price, 4) if avg_price > 0 else 0.0100
        micro_dollars = int(round(suggested_usd * settings.MICRO_DOLLARS_PER_USD))

        return PriceAdviceResponse(
            tool_name=request.name,
            category=request.category,
            suggested_price_usd=suggested_usd,
            suggested_price_micro_dollars=micro_dollars,
            min_viable_price_usd=round(min_price, 4),
            max_viable_price_usd=round(max_price, 4),
            confidence=0.6 if tools else 0.3,
            rationale=(
                f"Calculated from {len(tools)} comparable marketplace listings in '{request.category}' "
                f"(Market average: ${avg_price:.4f} USD). Anthropic Claude was unavailable."
            ),
            comparable_tools_count=len(tools),
            market_average_usd=round(avg_price, 4),
        )


price_advisor_service = PriceAdvisorService()
