import time
from typing import Dict, List, Optional
from app.clients.backend_client import backend_client, BackendToolRecord
from app.modules.tool_discovery.embeddings import TextSearchRanker
from app.modules.tool_discovery.schemas import (
    ToolDiscoveryRequest,
    ToolDiscoveryResponse,
    DiscoveredToolItem,
)
from app.core.config import settings
from app.core.logging import logger


class ToolDiscoveryService:
    def __init__(self, ranker: Optional[TextSearchRanker] = None):
        self.ranker = ranker or TextSearchRanker()

    async def discover_tools(
        self,
        request: ToolDiscoveryRequest,
        auth_headers: Optional[Dict[str, str]] = None,
    ) -> ToolDiscoveryResponse:
        start_time = time.perf_counter()

        # Step 1: Retrieve actual approved catalog from main backend
        all_tools: List[BackendToolRecord] = await backend_client.list_approved_tools(
            category=request.category,
            auth_headers=auth_headers
        )

        # Step 2: Apply metadata & permission-aware filtering
        candidates: List[BackendToolRecord] = []
        for tool in all_tools:
            # Active/Approved check
            if tool.status.lower() != "approved":
                continue

            # Permission whitelist check
            if request.allowed_tool_ids and tool.id not in request.allowed_tool_ids:
                continue

            # Price constraint check
            if request.max_price is not None and tool.price_per_call > request.max_price:
                continue

            # Reliability constraint check
            reliability = (tool.success_calls / tool.total_calls) if tool.total_calls > 0 else 1.0
            if reliability < (request.min_reliability or 0.0):
                continue

            candidates.append(tool)

        if not candidates:
            duration = (time.perf_counter() - start_time) * 1000
            return ToolDiscoveryResponse(
                task=request.task_prompt,
                total_candidates=0,
                matches=[],
                query_duration_ms=round(duration, 2),
            )

        # Step 3: Build searchable text document for each candidate
        doc_profiles = []
        for t in candidates:
            param_names = " ".join(t.input_schema.get("properties", {}).keys()) if isinstance(t.input_schema, dict) else ""
            profile_text = (
                f"{t.name} {t.category} {' '.join(t.tags)} {t.short_desc} "
                f"{t.detailed_desc or ''} {param_names}"
            )
            doc_profiles.append({"id": t.id, "text": profile_text})

        # Step 4: Semantic BM25 scoring
        relevance_scores = self.ranker.compute_scores(request.task_prompt, doc_profiles)

        # Step 5: Rank & compute composite score
        scored_items = []
        for i, tool in enumerate(candidates):
            rel_score = relevance_scores[i]
            reliability = (tool.success_calls / tool.total_calls) if tool.total_calls > 0 else 1.0

            # Composite ranking: semantic match + reliability + price reasonableness
            composite_score = (0.75 * rel_score) + (0.25 * reliability)

            micro_dollars = int(round(tool.price_per_call * settings.MICRO_DOLLARS_PER_USD))
            explanation = self._generate_explanation(tool, rel_score, request.task_prompt)

            scored_items.append((
                composite_score,
                DiscoveredToolItem(
                    tool_id=tool.id,
                    name=tool.name,
                    category=tool.category,
                    short_desc=tool.short_desc,
                    price_per_call=tool.price_per_call,
                    price_micro_dollars=micro_dollars,
                    currency=tool.currency,
                    relevance_score=rel_score,
                    reliability_score=round(reliability, 2),
                    input_schema=tool.input_schema,
                    output_schema=tool.output_schema,
                    match_explanation=explanation,
                )
            ))

        # Sort descending by composite score
        scored_items.sort(key=lambda x: x[0], reverse=True)
        top_matches = [item for _, item in scored_items[: request.limit]]

        duration = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"Tool discovery: evaluated {len(candidates)} tools, returning {len(top_matches)} matches in {duration:.1f}ms"
        )

        return ToolDiscoveryResponse(
            task=request.task_prompt,
            total_candidates=len(candidates),
            matches=top_matches,
            query_duration_ms=round(duration, 2),
        )

    def _generate_explanation(self, tool: BackendToolRecord, rel_score: float, task_prompt: str) -> str:
        if rel_score > 0.6:
            return f"High semantic alignment with category '{tool.category}' and capability '{tool.name}'."
        elif rel_score > 0.2:
            return f"Matched keywords in {tool.name} description ({tool.short_desc[:60]}...)."
        else:
            return f"Available tool in category '{tool.category}' compatible with general task domain."


discovery_service = ToolDiscoveryService()
