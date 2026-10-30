from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    per_call_limit: Decimal = Field(default=Decimal("1.0000"), ge=0, description="Max cost per single tool call")
    daily_limit: Decimal = Field(default=Decimal("25.0000"), ge=0, description="Daily spending ceiling")
    monthly_limit: Decimal = Field(default=Decimal("500.0000"), ge=0, description="Monthly spending ceiling")
    auto_approval_max: Decimal = Field(default=Decimal("0.1000"), ge=0, description="Max cost for automatic execution without human prompt")


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    per_call_limit: Optional[Decimal] = None
    daily_limit: Optional[Decimal] = None
    monthly_limit: Optional[Decimal] = None
    auto_approval_max: Optional[Decimal] = None
    is_active: Optional[bool] = None


class AgentResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: Optional[str]
    is_active: bool
    per_call_limit: Decimal
    daily_limit: Decimal
    monthly_limit: Decimal
    auto_approval_max: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CredentialCreate(BaseModel):
    name: str = Field(default="Primary Agent Key", max_length=100)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)


class CredentialCreatedResponse(BaseModel):
    id: str
    agent_id: str
    name: str
    key_prefix: str
    raw_token: str = Field(description="Only displayed once upon creation. Store securely.")
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CredentialSummary(BaseModel):
    id: str
    agent_id: str
    name: str
    key_prefix: str
    expires_at: Optional[datetime]
    revoked_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PermissionRule(BaseModel):
    allowed_category: Optional[str] = "*"
    allowed_tool_id: Optional[str] = None
    can_call: bool = True


class PermissionUpdate(BaseModel):
    permissions: List[PermissionRule]


class PermissionResponse(BaseModel):
    id: str
    agent_id: str
    allowed_category: Optional[str]
    allowed_tool_id: Optional[str]
    can_call: bool
    created_at: datetime

    class Config:
        from_attributes = True
