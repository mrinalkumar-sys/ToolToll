from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, encrypt_secret
from app.models.user import User, UserRole
from app.models.tool import Tool, ToolStatus, AuthType
from app.models.wallet import Wallet, LedgerEntry, LedgerType


async def seed_database(session: AsyncSession) -> None:
    """Seed initial users, wallets, and demo tools if not already present."""

    # 1. Admin User
    admin_query = await session.execute(select(User).where(User.email == "admin@tooltoll.io"))
    admin_user = admin_query.scalar_one_or_none()
    if not admin_user:
        admin_user = User(
            email="admin@tooltoll.io",
            full_name="Platform Administrator",
            hashed_password=hash_password("AdminPass123!"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin_user)
        await session.flush()
        # Admin wallet
        admin_wallet = Wallet(user_id=admin_user.id, balance=Decimal("100.0000"), reserved_balance=Decimal("0.0000"))
        session.add(admin_wallet)

    # 2. Creator User
    creator_query = await session.execute(select(User).where(User.email == "creator@tooltoll.io"))
    creator_user = creator_query.scalar_one_or_none()
    if not creator_user:
        creator_user = User(
            email="creator@tooltoll.io",
            full_name="Nova API Labs (Creator)",
            hashed_password=hash_password("CreatorPass123!"),
            role=UserRole.CREATOR,
            is_active=True,
        )
        session.add(creator_user)
        await session.flush()
        # Creator wallet
        creator_wallet = Wallet(user_id=creator_user.id, balance=Decimal("0.0000"), reserved_balance=Decimal("0.0000"))
        session.add(creator_wallet)

    # 3. Consumer User
    consumer_query = await session.execute(select(User).where(User.email == "consumer@tooltoll.io"))
    consumer_user = consumer_query.scalar_one_or_none()
    if not consumer_user:
        consumer_user = User(
            email="consumer@tooltoll.io",
            full_name="Agent Builder (Consumer)",
            hashed_password=hash_password("ConsumerPass123!"),
            role=UserRole.CONSUMER,
            is_active=True,
        )
        session.add(consumer_user)
        await session.flush()
        # Consumer initial wallet with $50.00 for testing
        consumer_wallet = Wallet(user_id=consumer_user.id, balance=Decimal("50.0000"), reserved_balance=Decimal("0.0000"))
        session.add(consumer_wallet)
        await session.flush()

        initial_credit = LedgerEntry(
            wallet_id=consumer_wallet.id,
            type=LedgerType.CREDIT_TOPUP,
            amount=Decimal("50.0000"),
            balance_after=Decimal("50.0000"),
            reference_id="welcome_credit",
            reference_type="topup",
            description="Welcome seed balance for immediate testing",
        )
        session.add(initial_credit)

    # 4. Safe Demo Tools (Section 14)
    # Tool 1: Text Translator
    t1_query = await session.execute(select(Tool).where(Tool.slug == "text-translator"))
    if not t1_query.scalar_one_or_none():
        tool1 = Tool(
            creator_id=creator_user.id,
            name="Neural Text Translator",
            slug="text-translator",
            short_desc="Translates text between English, Spanish, French, German, and Japanese with high semantic fidelity.",
            detailed_desc="Production-grade text translation tool supporting multilingual input. Automatically cleans formatting and produces natural linguistic output.",
            category="translation",
            tags=["nlp", "translation", "multilingual", "text"],
            base_url="https://api.internal-demo.tooltoll.io",
            endpoint_path="/v1/translate",
            http_method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "The text to translate"},
                    "target_language": {"type": "string", "enum": ["es", "fr", "de", "ja", "en"], "default": "en"},
                    "source_language": {"type": "string", "default": "auto"}
                },
                "required": ["text"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "translated_text": {"type": "string"},
                    "source_language": {"type": "string"},
                    "target_language": {"type": "string"},
                    "confidence": {"type": "number"}
                },
                "required": ["translated_text"]
            },
            auth_type=AuthType.NONE,
            price_per_call=Decimal("0.0150"),
            currency="USD",
            timeout_seconds=10,
            rate_limit_per_minute=120,
            terms_of_use="Standard commercial use permitted. No abusive or unlawful content.",
            creator_contact="support@novalabs.example.com",
            status=ToolStatus.APPROVED,
            is_internal_mock=True,
            total_calls=42,
            success_calls=42,
            average_latency_ms=145.0,
        )
        session.add(tool1)

    # Tool 2: Scam Message Risk Analyzer
    t2_query = await session.execute(select(Tool).where(Tool.slug == "scam-risk-analyzer"))
    if not t2_query.scalar_one_or_none():
        tool2 = Tool(
            creator_id=creator_user.id,
            name="Scam & Phishing Risk Analyzer",
            slug="scam-risk-analyzer",
            short_desc="Evaluates SMS, email, and chat messages for financial scam and phishing risk indicators.",
            detailed_desc="Scans message tokens for urgency cues, suspicious links, credential theft patterns, and banking impersonation. Disclaimer: This provides a heuristic risk assessment, not a legal or definitive determination.",
            category="security",
            tags=["security", "fraud", "scam-detection", "phishing", "sms"],
            base_url="https://api.internal-demo.tooltoll.io",
            endpoint_path="/v1/analyze-risk",
            http_method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Suspicious message or SMS body"},
                    "sender_info": {"type": "string", "description": "Optional sender phone number or email"}
                },
                "required": ["message"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "risk_level": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]},
                    "risk_score": {"type": "number"},
                    "indicators": {"type": "array", "items": {"type": "string"}},
                    "explanation": {"type": "string"},
                    "disclaimer": {"type": "string"}
                },
                "required": ["risk_level", "risk_score", "explanation", "disclaimer"]
            },
            auth_type=AuthType.NONE,
            price_per_call=Decimal("0.0250"),
            currency="USD",
            timeout_seconds=12,
            rate_limit_per_minute=90,
            terms_of_use="Advisory security signal. ToolToll and creator provide no warranty for undetected fraud.",
            creator_contact="security@novalabs.example.com",
            status=ToolStatus.APPROVED,
            is_internal_mock=True,
            total_calls=88,
            success_calls=87,
            average_latency_ms=210.0,
        )
        session.add(tool2)

    # Tool 3: Sentiment Analyzer
    t3_query = await session.execute(select(Tool).where(Tool.slug == "sentiment-analyzer"))
    if not t3_query.scalar_one_or_none():
        tool3 = Tool(
            creator_id=creator_user.id,
            name="Customer Sentiment & Emotion Analyzer",
            slug="sentiment-analyzer",
            short_desc="Quantifies positive, negative, and neutral sentiment alongside detected emotional undertones.",
            detailed_desc="Extracts polarity, subjectivity, and prominent emotions (e.g. frustration, satisfaction, urgency) from reviews, feedback, and customer queries.",
            category="nlp",
            tags=["nlp", "sentiment", "analytics", "emotion"],
            base_url="https://api.internal-demo.tooltoll.io",
            endpoint_path="/v1/sentiment",
            http_method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Customer feedback or statement to evaluate"}
                },
                "required": ["text"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "sentiment": {"type": "string", "enum": ["POSITIVE", "NEGATIVE", "NEUTRAL"]},
                    "polarity_score": {"type": "number"},
                    "dominant_emotion": {"type": "string"},
                    "highlights": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["sentiment", "polarity_score", "dominant_emotion"]
            },
            auth_type=AuthType.NONE,
            price_per_call=Decimal("0.0100"),
            currency="USD",
            timeout_seconds=8,
            rate_limit_per_minute=150,
            terms_of_use="General analytics use.",
            creator_contact="support@novalabs.example.com",
            status=ToolStatus.APPROVED,
            is_internal_mock=True,
            total_calls=130,
            success_calls=129,
            average_latency_ms=120.0,
        )
        session.add(tool3)

    await session.commit()
