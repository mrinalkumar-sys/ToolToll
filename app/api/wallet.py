from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.wallet import Wallet, LedgerEntry
from app.models.payment import CreatorEarning, PayoutRequest, PayoutStatus
from app.models.audit import ToolCall
from app.schemas.wallet import (
    WalletResponse,
    TopupCreateRequest,
    TopupResponse,
    PayPalCaptureRequest,
    LedgerEntryResponse,
    PayoutCreateRequest,
    PayoutResponse,
    CreatorEarningsSummary,
)
from app.schemas.execution import ToolCallResponse
from app.services.ledger_service import LedgerService
from app.services.paypal_service import PayPalService
from app.services.tool_service import ToolService
from app.api.deps import get_current_user

router = APIRouter(tags=["Wallet & Payments"])


@router.get("/wallet", response_model=WalletResponse)
async def get_wallet(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    wallet = await LedgerService.get_or_create_wallet(session, current_user.id)
    return WalletResponse(
        id=wallet.id,
        user_id=wallet.user_id,
        balance=wallet.balance,
        reserved_balance=wallet.reserved_balance,
        available_balance=wallet.available_balance,
        currency=wallet.currency,
        updated_at=wallet.updated_at,
    )


@router.get("/wallet/transactions", response_model=List[LedgerEntryResponse])
async def get_transactions(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    wallet = await LedgerService.get_or_create_wallet(session, current_user.id)
    stmt = (
        select(LedgerEntry)
        .where(LedgerEntry.wallet_id == wallet.id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    return [LedgerEntryResponse.model_validate(e) for e in res.scalars().all()]


@router.post("/paypal/orders")
async def create_paypal_order(
    data: TopupCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    use_mock = (data.payment_provider == "mock")
    order_id, approval_url = await PayPalService.create_order(
        session=session,
        user_id=current_user.id,
        amount=data.amount,
        use_mock=use_mock,
    )
    return {
        "order_id": order_id,
        "amount": data.amount,
        "approval_url": approval_url,
        "mode": "mock" if use_mock or order_id.startswith("MOCK-PP-") else "sandbox",
    }


@router.post("/paypal/orders/{order_id}/capture")
async def capture_paypal_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    success, amount, message = await PayPalService.capture_payment(session, order_id, current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {"success": True, "amount_credited": amount, "message": message}


@router.post("/webhooks/paypal")
async def paypal_webhook_receiver(
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    payload = await request.json()
    headers = dict(request.headers)
    success, msg = await PayPalService.process_webhook(session, headers, payload)
    return {"status": "received", "detail": msg}


@router.get("/calls", response_model=List[ToolCallResponse])
async def list_tool_calls(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ToolCall)
        .where(ToolCall.user_id == current_user.id)
        .order_by(ToolCall.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    calls = res.scalars().all()
    results = []
    for c in calls:
        tool = await ToolService.get_tool_by_id(session, c.tool_id)
        results.append(
            ToolCallResponse(
                call_id=c.id,
                tool_id=c.tool_id,
                tool_name=tool.name if tool else "Unknown Tool",
                status=c.status,
                response_output=c.response_output,
                duration_ms=c.duration_ms,
                price_charged=c.price_charged,
                quality_status=c.quality_status,
                reversal_reason=c.reversal_reason,
                created_at=c.created_at,
            )
        )
    return results


@router.get("/calls/{call_id}", response_model=ToolCallResponse)
async def get_tool_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(ToolCall).where(ToolCall.id == call_id)
    res = await session.execute(stmt)
    c = res.scalar_one_or_none()
    if not c or c.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool call record not found")

    tool = await ToolService.get_tool_by_id(session, c.tool_id)
    return ToolCallResponse(
        call_id=c.id,
        tool_id=c.tool_id,
        tool_name=tool.name if tool else "Unknown Tool",
        status=c.status,
        response_output=c.response_output,
        duration_ms=c.duration_ms,
        price_charged=c.price_charged,
        quality_status=c.quality_status,
        reversal_reason=c.reversal_reason,
        created_at=c.created_at,
    )


@router.get("/creator/earnings", response_model=CreatorEarningsSummary)
async def get_creator_earnings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(
        func.sum(CreatorEarning.gross_amount),
        func.sum(CreatorEarning.platform_fee),
        func.sum(CreatorEarning.net_amount),
        func.count(CreatorEarning.id),
    ).where(CreatorEarning.user_id == current_user.id)
    res = await session.execute(stmt)
    gross, fee, net, count = res.first() or (0, 0, 0, 0)

    # Pending payouts
    payout_stmt = select(func.sum(PayoutRequest.amount)).where(
        PayoutRequest.creator_id == current_user.id,
        PayoutRequest.status == PayoutStatus.PENDING,
    )
    payout_res = await session.execute(payout_stmt)
    pending_payouts = payout_res.scalar() or Decimal("0.0000")

    return CreatorEarningsSummary(
        gross_earnings=gross or Decimal("0.0000"),
        platform_fees=fee or Decimal("0.0000"),
        net_earnings=net or Decimal("0.0000"),
        total_calls=count or 0,
        pending_payouts=pending_payouts,
    )


@router.post("/creator/payouts", response_model=PayoutResponse)
async def request_payout(
    data: PayoutCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    try:
        payout = await PayPalService.request_creator_payout(
            session=session,
            creator_id=current_user.id,
            amount=data.amount,
            destination_email=data.payout_destination,
            payout_provider=data.payout_provider,
        )
        return PayoutResponse.model_validate(payout)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
