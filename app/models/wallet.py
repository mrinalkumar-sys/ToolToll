import enum
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class LedgerType(str, enum.Enum):
    CREDIT_TOPUP = "credit_topup"
    RESERVATION_HOLD = "reservation_hold"
    RESERVATION_RELEASE = "reservation_release"
    DEBIT_TOOL_CALL = "debit_tool_call"
    CREATOR_EARNING = "creator_earning"
    PLATFORM_COMMISSION = "platform_commission"
    REVERSAL_REFUND = "reversal_refund"
    PAYOUT_WITHDRAWAL = "payout_withdrawal"


class ReservationStatus(str, enum.Enum):
    ACTIVE = "active"
    COMMITTED = "committed"
    RELEASED = "released"


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    reserved_balance: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="wallet")
    reservations = relationship("WalletReservation", back_populates="wallet", cascade="all, delete-orphan")
    ledger_entries = relationship("LedgerEntry", back_populates="wallet", cascade="all, delete-orphan")

    @property
    def available_balance(self) -> Decimal:
        return self.balance - self.reserved_balance


class WalletReservation(Base):
    __tablename__ = "wallet_reservations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id: Mapped[str] = mapped_column(String(36), ForeignKey("wallets.id", ondelete="CASCADE"), index=True, nullable=False)
    agent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    tool_id: Mapped[str] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus), default=ReservationStatus.ACTIVE, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    wallet = relationship("Wallet", back_populates="reservations")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id: Mapped[str] = mapped_column(String(36), ForeignKey("wallets.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[LedgerType] = mapped_column(Enum(LedgerType), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    reference_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    reference_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "tool_call", "topup", "payout"
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    wallet = relationship("Wallet", back_populates="ledger_entries")
