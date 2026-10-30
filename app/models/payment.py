import enum
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Text, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TopupStatus(str, enum.Enum):
    INITIATED = "initiated"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PayoutStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Topup(Base):
    __tablename__ = "topups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    payment_provider: Mapped[str] = mapped_column(String(32), default="paypal", nullable=False)  # 'paypal' or 'mock'
    provider_order_id: Mapped[Optional[str]] = mapped_column(String(128), index=True, nullable=True)
    provider_capture_id: Mapped[Optional[str]] = mapped_column(String(128), index=True, nullable=True)
    status: Mapped[TopupStatus] = mapped_column(Enum(TopupStatus), default=TopupStatus.INITIATED, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="topups")


class PayPalOrder(Base):
    __tablename__ = "paypal_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    paypal_order_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="CREATED", nullable=False)  # CREATED, APPROVED, COMPLETED
    raw_response: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="paypal_orders")


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider: Mapped[str] = mapped_column(String(32), default="paypal", nullable=False)
    event_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[Any] = mapped_column(JSON, nullable=False)
    processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    payout_provider: Mapped[str] = mapped_column(String(32), default="mock", nullable=False)  # 'paypal' or 'mock'
    payout_batch_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payout_destination: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. creator paypal email
    status: Mapped[PayoutStatus] = mapped_column(Enum(PayoutStatus), default=PayoutStatus.PENDING, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    creator = relationship("User", back_populates="payout_requests")


class CreatorEarning(Base):
    __tablename__ = "creator_earnings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    tool_id: Mapped[str] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), index=True, nullable=False)
    call_id: Mapped[str] = mapped_column(String(36), ForeignKey("tool_calls.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    is_settled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    call = relationship("ToolCall", back_populates="creator_earning")
