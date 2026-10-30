import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Spending Controls (DECIMAL / NUMERIC for currency precision)
    per_call_limit: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("1.0000"), nullable=False)
    daily_limit: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("25.0000"), nullable=False)
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("500.0000"), nullable=False)
    auto_approval_max: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0.1000"), nullable=False)

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
    owner = relationship("User", back_populates="agents")
    credentials = relationship("AgentCredential", back_populates="agent", cascade="all, delete-orphan")
    permissions = relationship("AgentPermission", back_populates="agent", cascade="all, delete-orphan")
    tool_calls = relationship("ToolCall", back_populates="agent")


class AgentCredential(Base):
    __tablename__ = "agent_credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), default="Primary Key", nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)  # First 12 chars for easy identification
    hashed_key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)  # SHA-256 hex
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    agent = relationship("Agent", back_populates="credentials")


class AgentPermission(Base):
    __tablename__ = "agent_permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), index=True, nullable=False)
    allowed_category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # e.g. "nlp", "finance", "*"
    allowed_tool_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), nullable=True)
    can_call: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    agent = relationship("Agent", back_populates="permissions")
    tool = relationship("Tool")
