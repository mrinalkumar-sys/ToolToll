import pytest
from decimal import Decimal
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_complete_end_to_end_marketplace_scenario(client: AsyncClient):
    """
    Complete End-to-End Acceptance Scenario (Section 20):
    1. Creator registers an API
    2. Creator runs test and submits for approval
    3. Admin approves tool
    4. Tool appears in marketplace
    5. Consumer registers an AI agent with spending limits
    6. Consumer tops up wallet via payment adapter
    7. Consumer submits natural language task
    8. Agent autonomously discovers & ranks tools
    9. Tool executes and records results
    10. Ledger splits charges into creator earnings and platform fee
    11. Creator verifies usage and earnings
    """
    # ---------------------------------------------------------
    # Step 1: Creator registers API tool
    # ---------------------------------------------------------
    creator_login = await client.post(
        "/api/auth/login",
        json={"email": "creator@tooltoll.io", "password": "CreatorPass123!"},
    )
    creator_token = creator_login.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    new_tool_payload = {
        "name": "Text Forensics Sanitizer",
        "short_desc": "Removes PII and formats text safely for security and translation workflows",
        "category": "security",
        "tags": ["security", "sanitizer", "pii", "text"],
        "base_url": "https://api.internal-demo.tooltoll.io",
        "endpoint_path": "/v1/sanitize",
        "http_method": "POST",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
            },
            "required": ["message"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
            },
            "required": ["status"],
        },
        "price_per_call": "0.0200",
    }
    create_tool_res = await client.post("/api/tools", json=new_tool_payload, headers=creator_headers)
    assert create_tool_res.status_code == 201
    created_tool = create_tool_res.json()
    tool_id = created_tool["id"]
    assert created_tool["status"] == "draft"

    # Step 2: Creator runs controlled test and submits for approval
    test_run_res = await client.post(
        f"/api/tools/{tool_id}/test",
        json={"sample_input": {"message": "Test input text"}},
        headers=creator_headers,
    )
    assert test_run_res.status_code == 200
    assert test_run_res.json()["is_successful"] is True

    submit_res = await client.post(f"/api/tools/{tool_id}/submit", headers=creator_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "pending_approval"

    # ---------------------------------------------------------
    # Step 3: Admin reviews and approves tool
    # ---------------------------------------------------------
    admin_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@tooltoll.io", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    approve_res = await client.post(
        f"/api/admin/tools/{tool_id}/approve",
        json={"action": "approve", "reason": "Verified endpoint and output parameters"},
        headers=admin_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    # Step 4: Verify tool is visible in marketplace
    search_res = await client.get("/api/tools/search?q=sanitizer")
    assert search_res.status_code == 200
    assert any(t["id"] == tool_id for t in search_res.json())

    # ---------------------------------------------------------
    # Step 5: Consumer registers an AI agent with budget limits
    # ---------------------------------------------------------
    consumer_login = await client.post(
        "/api/auth/login",
        json={"email": "consumer@tooltoll.io", "password": "ConsumerPass123!"},
    )
    consumer_token = consumer_login.json()["access_token"]
    consumer_headers = {"Authorization": f"Bearer {consumer_token}"}

    agent_payload = {
        "name": "E2E Security Agent",
        "description": "Autonomous threat detection agent",
        "per_call_limit": "2.0000",
        "daily_limit": "50.0000",
        "monthly_limit": "500.0000",
        "auto_approval_max": "0.1000",
    }
    create_agent_res = await client.post("/api/agents", json=agent_payload, headers=consumer_headers)
    assert create_agent_res.status_code == 201
    agent_data = create_agent_res.json()
    agent_id = agent_data["agent"]["id"]
    agent_raw_token = agent_data["initial_credential"]["raw_token"]

    # ---------------------------------------------------------
    # Step 6: Consumer tops up wallet via payment adapter
    # ---------------------------------------------------------
    order_res = await client.post(
        "/api/paypal/orders",
        json={"amount": "40.0000", "payment_provider": "mock"},
        headers=consumer_headers,
    )
    assert order_res.status_code == 200
    order_id = order_res.json()["order_id"]

    cap_res = await client.post(f"/api/paypal/orders/{order_id}/capture", headers=consumer_headers)
    assert cap_res.status_code == 200
    assert cap_res.json()["success"] is True

    # ---------------------------------------------------------
    # Step 7: Consumer gives the agent a natural-language task
    # Step 8: Autonomous discovery & ranking
    # ---------------------------------------------------------
    task_prompt = "Translate this suspicious French message into English and analyze the security risk."
    plan_res = await client.post(
        "/api/agent/plan",
        json={"task_prompt": task_prompt, "agent_id": agent_id},
        headers={"X-Agent-Key": agent_raw_token},
    )
    assert plan_res.status_code == 200
    plan = plan_res.json()
    assert len(plan["selected_tools"]) >= 2
    assert plan["requires_human_approval"] is False  # Within auto-approval limit

    # ---------------------------------------------------------
    # Step 9: Agent executes selected tools
    # Step 10: Ledger records calls, charges, and splits
    # ---------------------------------------------------------
    initial_wallet = (await client.get("/api/wallet", headers=consumer_headers)).json()
    init_balance = Decimal(initial_wallet["available_balance"])

    exec_res = await client.post(
        "/api/agent/execute",
        json={"task_prompt": task_prompt, "agent_id": agent_id},
        headers={"X-Agent-Key": agent_raw_token},
    )
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["success"] is True
    total_cost = Decimal(exec_data["total_cost"])
    assert total_cost > 0

    # ---------------------------------------------------------
    # Step 11: Verify ledger balance updated correctly
    # ---------------------------------------------------------
    wallet_after = (await client.get("/api/wallet", headers=consumer_headers)).json()
    after_balance = Decimal(wallet_after["available_balance"])
    assert after_balance == init_balance - total_cost

    # ---------------------------------------------------------
    # Step 12: Creator verifies usage and earnings in dashboard
    # ---------------------------------------------------------
    creator_earnings_res = await client.get("/api/creator/earnings", headers=creator_headers)
    assert creator_earnings_res.status_code == 200
    creator_earnings = creator_earnings_res.json()
    assert Decimal(creator_earnings["net_earnings"]) > Decimal("0")
    assert creator_earnings["total_calls"] >= 1
