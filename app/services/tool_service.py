import re
import time
from decimal import Decimal
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import encrypt_secret, decrypt_secret
from app.core.ssrf import validate_outbound_url, SSRFValidationError
from app.models.tool import Tool, ToolStatus, AuthType, ToolTestRun, ToolVersion
from app.schemas.tool import ToolCreate, ToolUpdate


def _slugify(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", cleaned)


class ToolService:
    @staticmethod
    async def get_tool_by_id(session: AsyncSession, tool_id: str) -> Optional[Tool]:
        stmt = select(Tool).where(Tool.id == tool_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_tool_by_slug(session: AsyncSession, slug: str) -> Optional[Tool]:
        stmt = select(Tool).where(Tool.slug == slug)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def search_tools(
        session: AsyncSession,
        query: Optional[str] = None,
        category: Optional[str] = None,
        max_price: Optional[Decimal] = None,
        only_approved: bool = True,
        limit: int = 50,
    ) -> List[Tool]:
        """Search and rank tools in the marketplace."""
        conditions = []
        if only_approved:
            conditions.append(Tool.status == ToolStatus.APPROVED)

        if category and category.strip() and category != "*":
            conditions.append(Tool.category.ilike(f"%{category.strip()}%"))

        if max_price is not None:
            conditions.append(Tool.price_per_call <= max_price)

        if query and query.strip():
            q = f"%{query.strip()}%"
            conditions.append(
                or_(
                    Tool.name.ilike(q),
                    Tool.short_desc.ilike(q),
                    Tool.detailed_desc.ilike(q),
                    Tool.category.ilike(q),
                )
            )

        stmt = select(Tool).where(and_(*conditions)) if conditions else select(Tool)
        # Order by empirical success rate and lowest price
        stmt = stmt.order_by(desc(Tool.success_calls), Tool.price_per_call).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_tool(session: AsyncSession, creator_id: str, data: ToolCreate) -> Tool:
        # Check SSRF for outbound URL unless it's demo domain
        is_demo = "internal-demo" in data.base_url
        if not is_demo:
            validate_outbound_url(f"{data.base_url.rstrip('/')}{data.endpoint_path}")

        slug_candidate = _slugify(data.name)
        existing = await ToolService.get_tool_by_slug(session, slug_candidate)
        if existing:
            slug_candidate = f"{slug_candidate}-{int(time.time())}"

        encrypted_secret = None
        if data.upstream_secret:
            encrypted_secret = encrypt_secret(data.upstream_secret)

        tool = Tool(
            creator_id=creator_id,
            name=data.name,
            slug=slug_candidate,
            short_desc=data.short_desc,
            detailed_desc=data.detailed_desc,
            category=data.category.lower(),
            tags=data.tags,
            base_url=data.base_url.rstrip("/"),
            endpoint_path=data.endpoint_path if data.endpoint_path.startswith("/") else f"/{data.endpoint_path}",
            http_method=data.http_method.upper(),
            input_schema=data.input_schema,
            output_schema=data.output_schema,
            auth_type=data.auth_type,
            encrypted_secret=encrypted_secret,
            header_name=data.header_name,
            price_per_call=data.price_per_call,
            currency=data.currency.upper(),
            timeout_seconds=data.timeout_seconds,
            rate_limit_per_minute=data.rate_limit_per_minute,
            terms_of_use=data.terms_of_use,
            creator_contact=data.creator_contact,
            status=ToolStatus.DRAFT,
            is_internal_mock=is_demo,
        )
        session.add(tool)
        await session.flush()

        # Initial Version snapshot
        version = ToolVersion(
            tool_id=tool.id,
            version_num=1,
            snapshot_schema=data.input_schema,
            price_per_call=data.price_per_call,
        )
        session.add(version)
        await session.commit()
        await session.refresh(tool)
        return tool

    @staticmethod
    async def update_tool(session: AsyncSession, tool: Tool, data: ToolUpdate) -> Tool:
        update_data = data.model_dump(exclude_unset=True)

        if "base_url" in update_data or "endpoint_path" in update_data:
            base = update_data.get("base_url", tool.base_url)
            path = update_data.get("endpoint_path", tool.endpoint_path)
            if "internal-demo" not in base:
                validate_outbound_url(f"{base.rstrip('/')}{path}")

        if "upstream_secret" in update_data and update_data["upstream_secret"]:
            tool.encrypted_secret = encrypt_secret(update_data.pop("upstream_secret"))

        for key, value in update_data.items():
            setattr(tool, key, value)

        # Updating tool resets status to draft if previously approved, requiring re-validation
        if tool.status == ToolStatus.APPROVED:
            tool.status = ToolStatus.DRAFT

        await session.commit()
        await session.refresh(tool)
        return tool

    @staticmethod
    async def execute_tool_call_internal_or_remote(
        tool: Tool,
        input_data: Dict[str, Any],
    ) -> tuple[int, Any, float, Optional[str]]:
        """
        Execute either an internal demo tool or remote HTTP tool.
        Returns: (status_code, response_body, latency_ms, error_message)
        """
        start_time = time.perf_counter()

        # Handle Internal Demo Mock implementations
        if tool.is_internal_mock or "internal-demo" in tool.base_url:
            latency_ms = 45.0
            if tool.slug == "text-translator":
                text = input_data.get("text", "")
                target_lang = input_data.get("target_language", "en").lower()
                translations = {
                    "es": f"[ES] Hola, esto es una traducción fiel: '{text}'",
                    "fr": f"[FR] Bonjour, ceci est une traduction: '{text}'",
                    "de": f"[DE] Hallo, dies ist eine Übersetzung: '{text}'",
                    "ja": f"[JA] こんにちは、これは翻訳です: '{text}'",
                    "en": f"[EN] Hello, translated to English: '{text}'",
                }
                translated = translations.get(target_lang, f"[EN] {text}")
                latency_ms = (time.perf_counter() - start_time) * 1000 + 35.0
                return 200, {
                    "translated_text": translated,
                    "source_language": "detected-auto",
                    "target_language": target_lang,
                    "confidence": 0.98,
                }, latency_ms, None

            elif tool.slug == "scam-risk-analyzer":
                message = input_data.get("message", "").lower()
                # Deterministic heuristic risk scoring
                risk_score = 0.15
                indicators = []
                if any(w in message for w in ["urgent", "immediately", "action required", "act now"]):
                    risk_score += 0.30
                    indicators.append("Urgency cues detected designed to panic recipient")
                if any(w in message for w in ["bank", "wire", "transfer", "irs", "customs", "tax", "crypto"]):
                    risk_score += 0.25
                    indicators.append("Financial or official authority impersonation indicators")
                if any(w in message for w in ["http", "bit.ly", "tinyurl", "click here", "link"]):
                    risk_score += 0.25
                    indicators.append("Unverified external URL or redirection link")
                if any(w in message for w in ["password", "ssn", "pin", "verify account", "credentials"]):
                    risk_score += 0.35
                    indicators.append("Credential or identity theft solicitation")

                risk_level = "LOW"
                if risk_score >= 0.75:
                    risk_level = "CRITICAL"
                elif risk_score >= 0.50:
                    risk_level = "HIGH"
                elif risk_score >= 0.30:
                    risk_level = "MEDIUM"

                latency_ms = (time.perf_counter() - start_time) * 1000 + 40.0
                return 200, {
                    "risk_level": risk_level,
                    "risk_score": min(1.0, round(risk_score, 2)),
                    "indicators": indicators or ["No blatant threat indicators observed"],
                    "explanation": f"Message evaluated with a heuristic risk score of {risk_score:.2f}. "
                                   f"Identified {len(indicators)} risk warning factors.",
                    "disclaimer": "This is an automated heuristic security risk assessment and does not constitute a definitive or legal determination of fraud."
                }, latency_ms, None

            elif tool.slug == "sentiment-analyzer":
                text = input_data.get("text", "").lower()
                pos_words = ["great", "excellent", "love", "good", "happy", "fast", "helpful", "amazing"]
                neg_words = ["bad", "terrible", "hate", "awful", "scam", "broken", "slow", "horrible", "angry"]
                pos_count = sum(1 for w in pos_words if w in text)
                neg_count = sum(1 for w in neg_words if w in text)

                sentiment = "NEUTRAL"
                polarity = 0.0
                dominant = "Neutral inquiry"
                if pos_count > neg_count:
                    sentiment = "POSITIVE"
                    polarity = 0.75
                    dominant = "Satisfaction"
                elif neg_count > pos_count:
                    sentiment = "NEGATIVE"
                    polarity = -0.75
                    dominant = "Frustration"

                latency_ms = (time.perf_counter() - start_time) * 1000 + 30.0
                return 200, {
                    "sentiment": sentiment,
                    "polarity_score": polarity,
                    "dominant_emotion": dominant,
                    "highlights": [w for w in (pos_words + neg_words) if w in text],
                }, latency_ms, None

            else:
                latency_ms = (time.perf_counter() - start_time) * 1000 + 25.0
                return 200, {
                    "status": "success",
                    "tool": tool.name,
                    "result": "verified_demo_response",
                    "input_echo": input_data,
                }, latency_ms, None

        # Real outbound HTTP execution
        target_url = f"{tool.base_url.rstrip('/')}{tool.endpoint_path}"
        try:
            validate_outbound_url(target_url)
        except SSRFValidationError as e:
            return 0, None, 0.0, str(e)

        headers = {"User-Agent": "ToolToll-Agent-Runner/1.0", "Content-Type": "application/json"}
        if tool.auth_type == AuthType.API_KEY_HEADER and tool.header_name and tool.encrypted_secret:
            secret = decrypt_secret(tool.encrypted_secret)
            headers[tool.header_name] = secret
        elif tool.auth_type == AuthType.BEARER_TOKEN and tool.encrypted_secret:
            secret = decrypt_secret(tool.encrypted_secret)
            headers["Authorization"] = f"Bearer {secret}"

        try:
            async with httpx.AsyncClient(timeout=float(tool.timeout_seconds), follow_redirects=False) as client:
                resp = await client.request(
                    method=tool.http_method,
                    url=target_url,
                    json=input_data if tool.http_method in ("POST", "PUT", "PATCH") else None,
                    params=input_data if tool.http_method == "GET" else None,
                    headers=headers,
                )
                latency_ms = (time.perf_counter() - start_time) * 1000

                try:
                    body = resp.json()
                except Exception:
                    body = resp.text

                return resp.status_code, body, latency_ms, None
        except httpx.TimeoutException:
            latency_ms = (time.perf_counter() - start_time) * 1000
            return 408, None, latency_ms, f"Tool execution timed out after {tool.timeout_seconds} seconds"
        except httpx.RequestError as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            return 502, None, latency_ms, f"Outbound connection error: {str(e)}"

    @staticmethod
    async def test_tool(session: AsyncSession, tool: Tool, sample_input: Dict[str, Any]) -> ToolTestRun:
        status_code, body, latency_ms, err = await ToolService.execute_tool_call_internal_or_remote(tool, sample_input)
        is_success = (status_code is not None and 200 <= status_code < 300 and err is None)

        test_run = ToolTestRun(
            tool_id=tool.id,
            sample_input=sample_input,
            response_status=status_code,
            response_body=str(body) if body is not None else None,
            latency_ms=latency_ms,
            is_successful=is_success,
            error_message=err,
        )
        session.add(test_run)
        await session.commit()
        await session.refresh(test_run)
        return test_run
