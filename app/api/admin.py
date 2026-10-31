from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.tool import Tool, ToolStatus
from app.models.wallet import Wallet, WalletReservation, ReservationStatus
from app.models.agent import Agent
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


class UpdateCommissionRequest(BaseModel):
    platform_fee_percent: Optional[float] = Field(None, ge=0.0, le=0.50, description="Platform fee rate (0.0 to 0.50)")
    platform_fee_bps: Optional[int] = Field(None, ge=0, le=5000, description="Platform fee basis points (0 to 5000)")


@router.get("/commission")
async def get_commission(
    admin: User = Depends(get_current_admin),
):
    rate = getattr(settings, "PLATFORM_FEE_PERCENT", 0.15)
    bps = int(rate * 10000)
    return {
        "platform_fee_percent": rate,
        "platform_fee_bps": bps,
        "rate_percentage": f"{rate * 100:.2f}",
    }


@router.put("/commission")
async def update_commission(
    req: UpdateCommissionRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    if req.platform_fee_percent is not None:
        new_rate = req.platform_fee_percent
    elif req.platform_fee_bps is not None:
        new_rate = req.platform_fee_bps / 10000.0
    else:
        raise HTTPException(status_code=400, detail="Must provide platform_fee_percent or platform_fee_bps")

    settings.PLATFORM_FEE_PERCENT = new_rate
    bps = int(new_rate * 10000)

    # Log audit entry
    audit = AuditLog(
        user_id=admin.id,
        action="COMMISSION_UPDATED",
        entity_type="platform_setting",
        entity_id="PLATFORM_FEE_PERCENT",
        details={"new_rate": new_rate, "bps": bps},
    )
    session.add(audit)
    await session.commit()

    return {
        "message": "Platform commission updated successfully",
        "platform_fee_percent": new_rate,
        "platform_fee_bps": bps,
        "rate_percentage": f"{new_rate * 100:.2f}",
    }


@router.get("/creators")
async def list_creators(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(User)
        .where(User.role == UserRole.CREATOR)
        .options(selectinload(User.tools))
        .order_by(User.created_at.desc())
    )
    res = await session.execute(stmt)
    creators = res.scalars().all()

    result = []
    for c in creators:
        # Sum earnings for this creator
        stmt_earnings = (
            select(func.sum(ToolCall.creator_earnings), func.sum(ToolCall.price_charged))
            .join(Tool, ToolCall.tool_id == Tool.id)
            .where(Tool.creator_id == c.id)
        )
        earn_res = await session.execute(stmt_earnings)
        net_earn, gross_earn = earn_res.first() or (Decimal("0.0000"), Decimal("0.0000"))

        tools_data = []
        for t in c.tools:
            tools_data.append({
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "category": t.category,
                "short_description": t.short_desc,
                "base_url": t.base_url,
                "endpoint_path": t.endpoint_path,
                "http_method": t.http_method,
                "price_per_call": float(t.price_per_call),
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "total_calls": t.total_calls,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            })

        result.append({
            "id": c.id,
            "name": c.full_name,
            "email": c.email,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "total_tools": len(c.tools),
            "total_net_earnings": float(net_earn or 0),
            "total_gross_earnings": float(gross_earn or 0),
            "tools": tools_data,
        })

    return result


@router.get("/consumers")
async def list_consumers(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(User)
        .where(User.role == UserRole.CONSUMER)
        .options(selectinload(User.wallet), selectinload(User.agents))
        .order_by(User.created_at.desc())
    )
    res = await session.execute(stmt)
    consumers = res.scalars().all()

    result = []
    for u in consumers:
        # Aggregate tool calls
        stmt_calls = (
            select(
                func.count(ToolCall.id),
                func.sum(ToolCall.price_charged)
            )
            .where(ToolCall.user_id == u.id)
        )
        call_res = await session.execute(stmt_calls)
        total_calls, total_spent = call_res.first() or (0, Decimal("0.0000"))

        avail_bal = float(u.wallet.available_balance) if u.wallet else 0.0
        res_bal = float(u.wallet.reserved_balance) if u.wallet else 0.0

        agents_data = []
        if u.agents:
            for ag in u.agents:
                agents_data.append({
                    "id": ag.id,
                    "name": ag.name,
                    "is_active": ag.is_active,
                })

        result.append({
            "id": u.id,
            "name": u.full_name,
            "email": u.email,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "wallet_balance": avail_bal,
            "wallet_reserved": res_bal,
            "agents_count": len(u.agents) if u.agents else 0,
            "agents": agents_data,
            "total_calls_count": total_calls or 0,
            "total_spent": float(total_spent or 0),
        })

    return result


@router.get("/transactions")
async def list_transactions(
    limit: int = 100,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ToolCall)
        .options(
            selectinload(ToolCall.tool).selectinload(Tool.creator),
            selectinload(ToolCall.user),
            selectinload(ToolCall.agent),
        )
        .order_by(ToolCall.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    calls = res.scalars().all()

    transactions = []
    for c in calls:
        transactions.append({
            "id": c.id,
            "tool_id": c.tool_id,
            "tool_name": c.tool.name if c.tool else "Unknown Tool",
            "tool_slug": c.tool.slug if c.tool else "",
            "category": c.tool.category if c.tool else "General",
            "creator_name": c.tool.creator.full_name if (c.tool and c.tool.creator) else "Creator",
            "creator_email": c.tool.creator.email if (c.tool and c.tool.creator) else "",
            "consumer_name": c.user.full_name if c.user else "Consumer",
            "consumer_email": c.user.email if c.user else "",
            "agent_name": c.agent.name if c.agent else "Direct Agent",
            "price_charged": float(c.price_charged),
            "creator_earnings": float(c.creator_earnings),
            "platform_fee": float(c.platform_fee),
            "status": c.status.value if hasattr(c.status, "value") else str(c.status),
            "duration_ms": c.duration_ms,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return transactions
