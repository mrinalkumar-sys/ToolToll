import enum
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Text, Enum, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ToolCallStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REVERSED = "reversed"


class QualityStatus(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    UNCERTAIN = "uncertain"


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), index=True, nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    tool_id: Mapped[str] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), index=True, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    requested_input: Mapped[Any] = mapped_column(JSON, nullable=False)
    response_output: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Authoritative billing record
    price_charged: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0.0000"), nullable=False)
    creator_earnings: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0.0000"), nullable=False)
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0.0000"), nullable=False)

    status: Mapped[ToolCallStatus] = mapped_column(Enum(ToolCallStatus), default=ToolCallStatus.PENDING, index=True, nullable=False)
    reversal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quality_status: Mapped[QualityStatus] = mapped_column(Enum(QualityStatus), default=QualityStatus.PASS, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="tool_calls")
    agent = relationship("Agent", back_populates="tool_calls")
    tool = relationship("Tool", back_populates="tool_calls")
    creator_earning = relationship("CreatorEarning", back_populates="call", uselist=False, cascade="all, delete-orphan")
    quality_reviews = relationship("QualityReview", back_populates="call", cascade="all, delete-orphan")


class QualityReview(Base):
    __tablename__ = "quality_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tool_call_id: Mapped[str] = mapped_column(String(36), ForeignKey("tool_calls.id", ondelete="CASCADE"), index=True, nullable=False)
    check_type: Mapped[str] = mapped_column(String(32), default="deterministic", nullable=False)  # deterministic or semantic
    passed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    details: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    review_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    call = relationship("ToolCall", back_populates="quality_reviews")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    agent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    details: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class AdminReview(Base):
    __tablename__ = "admin_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tool_id: Mapped[str] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), index=True, nullable=False)
    admin_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)  # approved, rejected, suspended
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    tool = relationship("Tool", back_populates="admin_reviews")
    admin = relationship("User")
