from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class ToolReviewAction(BaseModel):
    action: str = Field(description="'approve', 'reject', or 'suspend'")
    reason: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    total_creators: int
    total_consumers: int
    total_tools: int
    pending_tools: int
    total_calls: int
    gross_volume: Decimal
    platform_revenue: Decimal
    active_reservations: int


class AdminAuditLogResponse(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: Optional[str]
    user_id: Optional[str]
    details: dict
    created_at: datetime

    class Config:
        from_attributes = True
