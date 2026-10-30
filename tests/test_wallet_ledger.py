import pytest
from decimal import Decimal
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_wallet_ledger_and_topup(client: AsyncClient):
    # 1. Login as consumer
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "consumer@tooltoll.io", "password": "ConsumerPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check initial wallet
    wallet_res = await client.get("/api/wallet", headers=headers)
    assert wallet_res.status_code == 200
    wallet = wallet_res.json()
    init_balance = Decimal(wallet["balance"])
    assert init_balance >= Decimal("50.0000")

    # 3. Create top-up order using mock payment adapter
    order_res = await client.post(
        "/api/paypal/orders",
        json={"amount": "25.0000", "payment_provider": "mock"},
        headers=headers,
    )
    assert order_res.status_code == 200
    order_data = order_res.json()
    order_id = order_data["order_id"]
    assert "MOCK-PP-" in order_id

    # 4. Capture order
    capture_res = await client.post(f"/api/paypal/orders/{order_id}/capture", headers=headers)
    assert capture_res.status_code == 200
    assert capture_res.json()["success"] is True

    # 5. Check wallet balance incremented
    wallet_res_after = await client.get("/api/wallet", headers=headers)
    new_balance = Decimal(wallet_res_after.json()["balance"])
    assert new_balance == init_balance + Decimal("25.0000")

    # 6. Check ledger transaction history
    tx_res = await client.get("/api/wallet/transactions", headers=headers)
    assert tx_res.status_code == 200
    txs = tx_res.json()
    assert len(txs) >= 1
    assert any(t["reference_id"] == order_id for t in txs)
