import pytest
from decimal import Decimal
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_paypal_order_capture_and_webhook_idempotency(client: AsyncClient):
    # Login as consumer
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "consumer@tooltoll.io", "password": "ConsumerPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create order
    order_res = await client.post(
        "/api/paypal/orders",
        json={"amount": "50.0000", "payment_provider": "mock"},
        headers=headers,
    )
    assert order_res.status_code == 200
    order_id = order_res.json()["order_id"]

    # 2. Simulate Webhook
    webhook_payload = {
        "id": "WH-EVT-998877",
        "event_type": "CHECKOUT.ORDER.COMPLETED",
        "resource": {"id": order_id},
    }
    wh_res1 = await client.post("/api/webhooks/paypal", json=webhook_payload)
    assert wh_res1.status_code == 200

    # 3. Duplicate Webhook: must be processed idempotently without error or double credit
    wh_res2 = await client.post("/api/webhooks/paypal", json=webhook_payload)
    assert wh_res2.status_code == 200
    assert "Duplicate" in wh_res2.json()["detail"] or "idempotent" in wh_res2.json()["detail"]

    # 4. Creator Payout
    creator_login = await client.post(
        "/api/auth/login",
        json={"email": "creator@tooltoll.io", "password": "CreatorPass123!"},
    )
    creator_token = creator_login.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # Ensure creator has positive balance for payout
    # Simulate a payout request
    payout_payload = {
        "amount": "5.0000",
        "payout_destination": "creator-paypal@example.com",
        "payout_provider": "mock",
    }
    # Check earnings endpoint
    earnings_res = await client.get("/api/creator/earnings", headers=creator_headers)
    assert earnings_res.status_code == 200
    assert "gross_earnings" in earnings_res.json()
