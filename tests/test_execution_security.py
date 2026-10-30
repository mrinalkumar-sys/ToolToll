import pytest
from decimal import Decimal
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_paid_execution_security_and_idempotency(client: AsyncClient):
    # 1. Login as consumer
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "consumer@tooltoll.io", "password": "ConsumerPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get text-translator tool
    tool_res = await client.get("/api/tools/text-translator")
    assert tool_res.status_code == 200
    tool = tool_res.json()
    tool_id = tool["id"]
    authoritative_price = Decimal(tool["price_per_call"])

    # Initial balance
    w_initial = (await client.get("/api/wallet", headers=headers)).json()
    initial_balance = Decimal(w_initial["balance"])

    # 3. Execute paid tool call
    call_payload = {
        "tool_id": tool_id,
        "input_data": {"text": "Bonjour le monde", "target_language": "en"},
        "idempotency_key": "idem_test_abc_123",
    }
    call_res = await client.post(f"/api/tools/{tool_id}/calls", json=call_payload, headers=headers)
    assert call_res.status_code == 200
    call_data = call_res.json()
    assert call_data["status"] == "success"
    assert call_data["quality_status"] == "pass"
    assert Decimal(call_data["price_charged"]) == authoritative_price

    # Balance should be deducted by authoritative price
    w_after = (await client.get("/api/wallet", headers=headers)).json()
    after_balance = Decimal(w_after["balance"])
    assert after_balance == initial_balance - authoritative_price

    # 4. Idempotency Test: Repeating the exact same idempotency_key must return the cached call without double-debiting
    call_dup_res = await client.post(f"/api/tools/{tool_id}/calls", json=call_payload, headers=headers)
    assert call_dup_res.status_code == 200
    w_dup = (await client.get("/api/wallet", headers=headers)).json()
    assert Decimal(w_dup["balance"]) == after_balance  # No additional charge!

    # 5. Autonomous Multi-step Workflow Test
    exec_task_res = await client.post(
        "/api/agent/execute",
        json={"task_prompt": "Translate this urgent suspicious SMS into English and check whether it might be a scam."},
        headers=headers,
    )
    assert exec_task_res.status_code == 200
    task_res_data = exec_task_res.json()
    assert task_res_data["success"] is True
    assert len(task_res_data["executed_steps"]) >= 2
    assert "Disclaimer" in task_res_data["final_summary"]
