import enum
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Text, Enum, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ToolStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    RETIRED = "retired"


class AuthType(str, enum.Enum):
    NONE = "none"
    API_KEY_HEADER = "api_key_header"
    BEARER_TOKEN = "bearer_token"


class Tool(Base):
    __tablename__ = "tools"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    short_desc: Mapped[str] = mapped_column(String(255), nullable=False)
    detailed_desc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    tags: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)

    # API Connection
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    endpoint_path: Mapped[str] = mapped_column(String(255), default="/", nullable=False)
    http_method: Mapped[str] = mapped_column(String(10), default="POST", nullable=False)

    # Schemas
    input_schema: Mapped[Any] = mapped_column(JSON, nullable=False)
    output_schema: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    # Auth configuration
    auth_type: Mapped[AuthType] = mapped_column(Enum(AuthType), default=AuthType.NONE, nullable=False)
    encrypted_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    header_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # e.g. "X-API-Key"

    # Pricing & Limits
    price_per_call: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0.0100"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    terms_of_use: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creator_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Moderation & Life-cycle
    status: Mapped[ToolStatus] = mapped_column(Enum(ToolStatus), default=ToolStatus.DRAFT, index=True, nullable=False)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_internal_mock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Reliability and Telemetry (Empirical metrics)
    total_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    average_latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    creator = relationship("User", back_populates="tools")
    versions = relationship("ToolVersion", back_populates="tool", cascade="all, delete-orphan")
    test_runs = relationship("ToolTestRun", back_populates="tool", cascade="all, delete-orphan")
    tool_calls = relationship("ToolCall", back_populates="tool")
    admin_reviews = relationship("AdminReview", back_populates="tool", cascade="all, delete-orphan")


class ToolVersion(Base):
    __tablename__ = "tool_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tool_id: Mapped[str] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), index=True, nullable=False)
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_schema: Mapped[Any] = mapped_column(JSON, nullable=False)
    price_per_call: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    tool = relationship("Tool", back_populates="versions")


class ToolTestRun(Base):
    __tablename__ = "tool_test_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tool_id: Mapped[str] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), index=True, nullable=False)
    sample_input: Mapped[Any] = mapped_column(JSON, nullable=False)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_successful: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    tool = relationship("Tool", back_populates="test_runs")
