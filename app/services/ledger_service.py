from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, Tuple
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.wallet import Wallet, WalletReservation, LedgerEntry, LedgerType, ReservationStatus
from app.models.payment import CreatorEarning
from app.models.audit import ToolCall, ToolCallStatus, QualityStatus


class InsufficientBalanceError(Exception):
    """Raised when wallet available balance is insufficient."""
    pass


class ReservationExpiredOrInvalidError(Exception):
    """Raised when reservation cannot be committed or released."""
    pass


class LedgerService:
    @staticmethod
    async def get_or_create_wallet(session: AsyncSession, user_id: str) -> Wallet:
        """Fetch user wallet or create a new one with 0 balance."""
        stmt = select(Wallet).where(Wallet.user_id == user_id)
        result = await session.execute(stmt)
        wallet = result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(user_id=user_id, balance=Decimal("0.0000"), reserved_balance=Decimal("0.0000"))
            session.add(wallet)
            await session.flush()
        return wallet

    @staticmethod
    async def credit_wallet(
        session: AsyncSession,
        user_id: str,
        amount: Decimal,
        reference_id: str,
        reference_type: str = "topup",
        description: str = "Wallet Top-up",
    ) -> LedgerEntry:
        """Add funds to user wallet atomically and record ledger entry."""
        wallet = await LedgerService.get_or_create_wallet(session, user_id)
        wallet.balance += amount
        new_balance = wallet.balance

        entry = LedgerEntry(
            wallet_id=wallet.id,
            type=LedgerType.CREDIT_TOPUP,
            amount=amount,
            balance_after=new_balance,
            reference_id=reference_id,
            reference_type=reference_type,
            description=description,
        )
        session.add(entry)
        await session.flush()
        return entry

    @staticmethod
    async def hold_reservation(
        session: AsyncSession,
        user_id: str,
        tool_id: str,
        amount: Decimal,
        idempotency_key: str,
        agent_id: Optional[str] = None,
        ttl_seconds: int = 60,
    ) -> WalletReservation:
        """
        Atomically reserve balance for an upcoming paid tool call.
        Fails if available balance < amount.
        """
        # Check idempotency first: if active reservation already exists, return it
        stmt_exist = select(WalletReservation).where(WalletReservation.idempotency_key == idempotency_key)
        res_exist = await session.execute(stmt_exist)
        existing = res_exist.scalar_one_or_none()
        if existing:
            return existing

        wallet = await LedgerService.get_or_create_wallet(session, user_id)

        # Check balance
        available = wallet.balance - wallet.reserved_balance
        if available < amount:
            raise InsufficientBalanceError(
                f"Insufficient funds: Available ${available:.4f} is less than required ${amount:.4f}"
            )

        # Reserve funds
        wallet.reserved_balance += amount
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

        reservation = WalletReservation(
            wallet_id=wallet.id,
            agent_id=agent_id,
            tool_id=tool_id,
            amount=amount,
            idempotency_key=idempotency_key,
            status=ReservationStatus.ACTIVE,
            expires_at=expires_at,
        )
        session.add(reservation)

        # Record ledger hold entry
        entry = LedgerEntry(
            wallet_id=wallet.id,
            type=LedgerType.RESERVATION_HOLD,
            amount=amount,
            balance_after=wallet.balance - wallet.reserved_balance,
            reference_id=idempotency_key,
            reference_type="reservation",
            description=f"Pre-authorization hold of ${amount:.4f} for tool execution",
        )
        session.add(entry)
        await session.flush()
        return reservation

    @staticmethod
    async def finalize_charge(
        session: AsyncSession,
        reservation: WalletReservation,
        consumer_user_id: str,
        creator_user_id: str,
        tool_id: str,
        call_id: str,
        authoritative_price: Decimal,
    ) -> Tuple[Decimal, Decimal, Decimal]:
        """
        Commit tool charge upon successful tool execution:
        1. Release reservation
        2. Deduct price from consumer wallet
        3. Split into platform commission and creator net earnings
        4. Credit creator wallet
        Returns (price_charged, creator_earnings, platform_fee)
        """
        consumer_wallet = await LedgerService.get_or_create_wallet(session, consumer_user_id)
        creator_wallet = await LedgerService.get_or_create_wallet(session, creator_user_id)

        # Release reservation hold
        consumer_wallet.reserved_balance = max(Decimal("0.0000"), consumer_wallet.reserved_balance - reservation.amount)
        # Deduct actual price
        consumer_wallet.balance -= authoritative_price
        reservation.status = ReservationStatus.COMMITTED

        # Calculate splits
        fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT))
        platform_fee = (authoritative_price * fee_percent).quantize(Decimal("0.0001"))
        creator_earnings = (authoritative_price - platform_fee).quantize(Decimal("0.0001"))

        # Credit creator
        creator_wallet.balance += creator_earnings

        # Ledger entries
        consumer_entry = LedgerEntry(
            wallet_id=consumer_wallet.id,
            type=LedgerType.DEBIT_TOOL_CALL,
            amount=authoritative_price,
            balance_after=consumer_wallet.balance,
            reference_id=call_id,
            reference_type="tool_call",
            description=f"Paid tool call charge: ${authoritative_price:.4f}",
        )
        session.add(consumer_entry)

        creator_entry = LedgerEntry(
            wallet_id=creator_wallet.id,
            type=LedgerType.CREATOR_EARNING,
            amount=creator_earnings,
            balance_after=creator_wallet.balance,
            reference_id=call_id,
            reference_type="tool_call",
            description=f"Creator net earnings for tool call (Gross: ${authoritative_price:.4f}, Fee: ${platform_fee:.4f})",
        )
        session.add(creator_entry)

        # Creator Earning Record
        earning_record = CreatorEarning(
            user_id=creator_user_id,
            tool_id=tool_id,
            call_id=call_id,
            gross_amount=authoritative_price,
            platform_fee=platform_fee,
            net_amount=creator_earnings,
            is_settled=True,
        )
        session.add(earning_record)

        await session.flush()
        return authoritative_price, creator_earnings, platform_fee

    @staticmethod
    async def release_reservation(
        session: AsyncSession,
        reservation: WalletReservation,
        consumer_user_id: str,
        reason: str = "Execution cancelled or failed before completion",
    ) -> None:
        """Release reservation hold back to consumer available balance without charging."""
        if reservation.status != ReservationStatus.ACTIVE:
            return

        wallet = await LedgerService.get_or_create_wallet(session, consumer_user_id)
        wallet.reserved_balance = max(Decimal("0.0000"), wallet.reserved_balance - reservation.amount)
        reservation.status = ReservationStatus.RELEASED

        entry = LedgerEntry(
            wallet_id=wallet.id,
            type=LedgerType.RESERVATION_RELEASE,
            amount=reservation.amount,
            balance_after=wallet.balance - wallet.reserved_balance,
            reference_id=reservation.idempotency_key,
            reference_type="reservation_release",
            description=f"Released reservation hold: {reason}",
        )
        session.add(entry)
        await session.flush()

    @staticmethod
    async def reverse_charge(
        session: AsyncSession,
        call: ToolCall,
        creator_user_id: str,
        reason: str,
    ) -> None:
        """
        Reverse a committed charge and refund the consumer.
        Used for eligible quality failures or administrative refunds.
        """
        if call.status == ToolCallStatus.REVERSED:
            return

        consumer_wallet = await LedgerService.get_or_create_wallet(session, call.user_id)
        creator_wallet = await LedgerService.get_or_create_wallet(session, creator_user_id)

        # Refund consumer
        consumer_wallet.balance += call.price_charged
        # Debit creator
        creator_wallet.balance = max(Decimal("0.0000"), creator_wallet.balance - call.creator_earnings)

        call.status = ToolCallStatus.REVERSED
        call.reversal_reason = reason

        entry_consumer = LedgerEntry(
            wallet_id=consumer_wallet.id,
            type=LedgerType.REVERSAL_REFUND,
            amount=call.price_charged,
            balance_after=consumer_wallet.balance,
            reference_id=call.id,
            reference_type="tool_call_reversal",
            description=f"Refund for tool call: {reason}",
        )
        session.add(entry_consumer)

        await session.flush()
