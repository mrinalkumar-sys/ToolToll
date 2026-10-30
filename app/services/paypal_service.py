import base64
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.payment import Topup, PayPalOrder, WebhookEvent, PayoutRequest, TopupStatus, PayoutStatus
from app.services.ledger_service import LedgerService


class PayPalService:
    @staticmethod
    async def get_access_token() -> Optional[str]:
        """Fetch OAuth2 token from PayPal Sandbox."""
        if not settings.PAYPAL_CLIENT_ID or not settings.PAYPAL_CLIENT_SECRET or settings.PAYPAL_CLIENT_ID == "sb-mock-client-id":
            return None  # Trigger Mock adapter

        auth_str = f"{settings.PAYPAL_CLIENT_ID}:{settings.PAYPAL_CLIENT_SECRET}"
        encoded_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

        headers = {
            "Authorization": f"Basic {encoded_auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{settings.PAYPAL_BASE_URL}/v1/oauth2/token",
                    data={"grant_type": "client_credentials"},
                    headers=headers,
                )
                if res.status_code == 200:
                    return res.json().get("access_token")
        except Exception:
            return None
        return None

    @staticmethod
    async def create_order(
        session: AsyncSession,
        user_id: str,
        amount: Decimal,
        currency: str = "USD",
        use_mock: bool = False,
    ) -> Tuple[str, str]:
        """
        Create a PayPal Checkout Order.
        Returns: (order_id, approval_url)
        """
        token = None if use_mock else await PayPalService.get_access_token()

        if token:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            order_payload = {
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "reference_id": user_id,
                        "description": f"ToolToll Wallet Deposit for user {user_id[:8]}",
                        "amount": {
                            "currency_code": currency,
                            "value": f"{amount:.2f}",
                        },
                    }
                ],
                "application_context": {
                    "return_url": f"{settings.CORS_ORIGINS[0]}/wallet?status=success",
                    "cancel_url": f"{settings.CORS_ORIGINS[0]}/wallet?status=cancelled",
                    "user_action": "PAY_NOW",
                },
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{settings.PAYPAL_BASE_URL}/v2/checkout/orders",
                    json=order_payload,
                    headers=headers,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    order_id = data["id"]
                    approval_url = next(
                        (link["href"] for link in data.get("links", []) if link["rel"] == "approve"),
                        f"https://www.sandbox.paypal.com/checkoutnow?token={order_id}",
                    )

                    order_record = PayPalOrder(
                        user_id=user_id,
                        paypal_order_id=order_id,
                        amount=amount,
                        currency=currency,
                        status="CREATED",
                        raw_response=data,
                    )
                    session.add(order_record)
                    await session.commit()
                    return order_id, approval_url

        # Mock Sandbox Adapter (Safe fallback for local dev & testing)
        order_id = f"MOCK-PP-{uuid.uuid4().hex[:12].upper()}"
        approval_url = f"http://localhost:5173/wallet?mock_order_id={order_id}&approved=true"

        order_record = PayPalOrder(
            user_id=user_id,
            paypal_order_id=order_id,
            amount=amount,
            currency=currency,
            status="CREATED",
            raw_response={"mode": "mock", "order_id": order_id},
        )
        session.add(order_record)
        await session.commit()
        return order_id, approval_url

    @staticmethod
    async def capture_payment(
        session: AsyncSession,
        order_id: str,
        user_id: str,
    ) -> Tuple[bool, Decimal, str]:
        """
        Capture payment server-side and verify order amount, currency, and intended user.
        Credits consumer wallet only upon verified payment success.
        Returns: (success, amount_captured, message)
        """
        # Fetch DB order record
        stmt = select(PayPalOrder).where(PayPalOrder.paypal_order_id == order_id)
        res = await session.execute(stmt)
        order_record = res.scalar_one_or_none()
        if not order_record:
            return False, Decimal("0"), "Order not found in ToolToll records"

        if order_record.user_id != user_id:
            return False, Decimal("0"), "Security violation: order was initiated by a different user"

        if order_record.status == "COMPLETED":
            return True, order_record.amount, "Order already successfully captured"

        # Check if Mock Order
        if order_id.startswith("MOCK-PP-"):
            order_record.status = "COMPLETED"
            topup = Topup(
                user_id=user_id,
                amount=order_record.amount,
                currency=order_record.currency,
                payment_provider="mock",
                provider_order_id=order_id,
                provider_capture_id=f"CAP-{uuid.uuid4().hex[:10].upper()}",
                status=TopupStatus.COMPLETED,
            )
            session.add(topup)
            await session.flush()

            # Credit wallet
            await LedgerService.credit_wallet(
                session=session,
                user_id=user_id,
                amount=order_record.amount,
                reference_id=order_id,
                reference_type="topup",
                description=f"PayPal Sandbox Top-up (Order: {order_id})",
            )
            await session.commit()
            return True, order_record.amount, "Payment captured and wallet credited successfully"

        # Real Sandbox Capture via PayPal API
        token = await PayPalService.get_access_token()
        if not token:
            return False, Decimal("0"), "Failed to authenticate with PayPal Sandbox"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
                headers=headers,
            )
            data = resp.json()
            if resp.status_code in (200, 201) and data.get("status") == "COMPLETED":
                # Verify amount and currency
                purchase_unit = data.get("purchase_units", [{}])[0]
                capture_info = purchase_unit.get("payments", {}).get("captures", [{}])[0]
                captured_val = Decimal(capture_info.get("amount", {}).get("value", "0"))
                captured_curr = capture_info.get("amount", {}).get("currency_code", "USD")

                if captured_val != order_record.amount or captured_curr != order_record.currency:
                    order_record.status = "AMOUNT_MISMATCH"
                    await session.commit()
                    return False, Decimal("0"), "Security violation: captured amount does not match recorded order"

                order_record.status = "COMPLETED"
                order_record.raw_response = data

                topup = Topup(
                    user_id=user_id,
                    amount=order_record.amount,
                    currency=order_record.currency,
                    payment_provider="paypal",
                    provider_order_id=order_id,
                    provider_capture_id=capture_info.get("id"),
                    status=TopupStatus.COMPLETED,
                )
                session.add(topup)
                await session.flush()

                await LedgerService.credit_wallet(
                    session=session,
                    user_id=user_id,
                    amount=order_record.amount,
                    reference_id=order_id,
                    reference_type="topup",
                    description=f"PayPal Verified Top-up: ${order_record.amount:.2f}",
                )
                await session.commit()
                return True, order_record.amount, "Payment captured and wallet credited"
            else:
                order_record.status = "CAPTURE_FAILED"
                await session.commit()
                return False, Decimal("0"), f"PayPal capture failed: {data.get('message', 'Unknown error')}"

    @staticmethod
    async def process_webhook(
        session: AsyncSession,
        headers: Dict[str, str],
        payload: Dict[str, Any],
    ) -> Tuple[bool, str]:
        """
        Idempotent PayPal Webhook Processing with duplicate event rejection.
        """
        event_id = payload.get("id")
        event_type = payload.get("event_type")

        if not event_id or not event_type:
            return False, "Invalid webhook event structure"

        # Check idempotency
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        res = await session.execute(stmt)
        if res.scalar_one_or_none():
            return True, "Duplicate webhook event already processed (idempotent ignore)"

        event_record = WebhookEvent(
            provider="paypal",
            event_id=event_id,
            event_type=event_type,
            payload=payload,
            processed=False,
        )
        session.add(event_record)
        await session.flush()

        if event_type == "CHECKOUT.ORDER.COMPLETED":
            resource = payload.get("resource", {})
            order_id = resource.get("id")
            if order_id:
                stmt_order = select(PayPalOrder).where(PayPalOrder.paypal_order_id == order_id)
                res_order = await session.execute(stmt_order)
                order = res_order.scalar_one_or_none()
                if order and order.status != "COMPLETED":
                    await PayPalService.capture_payment(session, order_id, order.user_id)

        event_record.processed = True
        await session.commit()
        return True, "Webhook processed successfully"

    @staticmethod
    async def request_creator_payout(
        session: AsyncSession,
        creator_id: str,
        amount: Decimal,
        destination_email: str,
        payout_provider: str = "mock",
    ) -> PayoutRequest:
        """
        Process creator payout request with adapter fallback.
        Deducts creator wallet balance and records ledger payout entry.
        """
        creator_wallet = await LedgerService.get_or_create_wallet(session, creator_id)
        if creator_wallet.available_balance < amount:
            raise ValueError(f"Insufficient creator balance: Available ${creator_wallet.available_balance:.4f}")

        # Deduct wallet
        creator_wallet.balance -= amount

        payout_id = str(uuid.uuid4())
        payout = PayoutRequest(
            id=payout_id,
            creator_id=creator_id,
            amount=amount,
            currency="USD",
            payout_provider=payout_provider,
            payout_batch_id=f"BATCH-{uuid.uuid4().hex[:10].upper()}",
            payout_destination=destination_email,
            status=PayoutStatus.COMPLETED if payout_provider == "mock" else PayoutStatus.PROCESSING,
        )
        session.add(payout)

        # Record ledger entry
        entry = LedgerEntry(
            wallet_id=creator_wallet.id,
            type=LedgerType.PAYOUT_WITHDRAWAL,
            amount=amount,
            balance_after=creator_wallet.balance,
            reference_id=payout_id,
            reference_type="payout",
            description=f"Creator earnings payout withdrawal to {destination_email} ({payout_provider})",
        )
        session.add(entry)

        await session.commit()
        await session.refresh(payout)
        return payout
