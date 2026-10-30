from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.tool import Tool, ToolStatus
from app.models.wallet import WalletReservation, ReservationStatus
from app.models.audit import ToolCall, AuditLog, AdminReview
from app.schemas.tool import ToolResponse
from app.schemas.admin import ToolReviewAction, AdminStatsResponse, AdminAuditLogResponse
from app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Administration & Moderation"])


@router.get("/tools/pending", response_model=List[ToolResponse])
async def list_pending_tools(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Tool)
        .where(Tool.status == ToolStatus.PENDING_APPROVAL)
        .order_by(Tool.created_at.asc())
    )
    res = await session.execute(stmt)
    return [ToolResponse.model_validate(t) for t in res.scalars().all()]


@router.post("/tools/{tool_id}/approve", response_model=ToolResponse)
async def approve_tool(
    tool_id: str,
    action_data: ToolReviewAction,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(Tool).where(Tool.id == tool_id)
    res = await session.execute(stmt)
    tool = res.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

    tool.status = ToolStatus.APPROVED
    tool.rejection_reason = None

    review = AdminReview(
        tool_id=tool.id,
        admin_id=admin.id,
        action="approved",
        reason=action_data.reason or "Passed automated checks and manual inspection",
    )
    session.add(review)
    await session.commit()
    await session.refresh(tool)
    return ToolResponse.model_validate(tool)


@router.post("/tools/{tool_id}/reject", response_model=ToolResponse)
async def reject_tool(
    tool_id: str,
    action_data: ToolReviewAction,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(Tool).where(Tool.id == tool_id)
    res = await session.execute(stmt)
    tool = res.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

    tool.status = ToolStatus.REJECTED
    tool.rejection_reason = action_data.reason or "Rejected by moderator"

    review = AdminReview(
        tool_id=tool.id,
        admin_id=admin.id,
        action="rejected",
        reason=action_data.reason,
    )
    session.add(review)
    await session.commit()
    await session.refresh(tool)
    return ToolResponse.model_validate(tool)


@router.post("/tools/{tool_id}/suspend", response_model=ToolResponse)
async def suspend_tool(
    tool_id: str,
    action_data: ToolReviewAction,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(Tool).where(Tool.id == tool_id)
    res = await session.execute(stmt)
    tool = res.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

    tool.status = ToolStatus.SUSPENDED
    tool.rejection_reason = action_data.reason or "Suspended by moderator due to policy violation or abuse reports"

    review = AdminReview(
        tool_id=tool.id,
        admin_id=admin.id,
        action="suspended",
        reason=action_data.reason,
    )
    session.add(review)
    await session.commit()
    await session.refresh(tool)
    return ToolResponse.model_validate(tool)


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    total_users = (await session.execute(select(func.count(User.id)))).scalar() or 0
    total_creators = (await session.execute(select(func.count(User.id)).where(User.role == UserRole.CREATOR))).scalar() or 0
    total_consumers = (await session.execute(select(func.count(User.id)).where(User.role == UserRole.CONSUMER))).scalar() or 0

    total_tools = (await session.execute(select(func.count(Tool.id)))).scalar() or 0
    pending_tools = (await session.execute(select(func.count(Tool.id)).where(Tool.status == ToolStatus.PENDING_APPROVAL))).scalar() or 0

    total_calls = (await session.execute(select(func.count(ToolCall.id)))).scalar() or 0
    gross_volume = (await session.execute(select(func.sum(ToolCall.price_charged)))).scalar() or Decimal("0.0000")
    platform_revenue = (await session.execute(select(func.sum(ToolCall.platform_fee)))).scalar() or Decimal("0.0000")

    active_reservations = (
        await session.execute(select(func.count(WalletReservation.id)).where(WalletReservation.status == ReservationStatus.ACTIVE))
    ).scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        total_creators=total_creators,
        total_consumers=total_consumers,
        total_tools=total_tools,
        pending_tools=pending_tools,
        total_calls=total_calls,
        gross_volume=gross_volume,
        platform_revenue=platform_revenue,
        active_reservations=active_reservations,
    )


@router.get("/audit-logs", response_model=List[AdminAuditLogResponse])
async def list_audit_logs(
    limit: int = 50,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    res = await session.execute(stmt)
    return [AdminAuditLogResponse.model_validate(a) for a in res.scalars().all()]
