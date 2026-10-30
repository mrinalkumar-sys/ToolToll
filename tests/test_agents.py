import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_agent_lifecycle_and_credentials(client: AsyncClient):
    # Login as consumer
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "consumer@tooltoll.io", "password": "ConsumerPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create an agent
    agent_payload = {
        "name": "Market Research Bot",
        "description": "Analyzes market data",
        "per_call_limit": "0.5000",
        "daily_limit": "10.0000",
        "monthly_limit": "100.0000",
        "auto_approval_max": "0.0500",
    }
    create_res = await client.post("/api/agents", json=agent_payload, headers=headers)
    assert create_res.status_code == 201
    data = create_res.json()
    agent_id = data["agent"]["id"]
    raw_token = data["initial_credential"]["raw_token"]
    assert raw_token.startswith("tt_agent_")
    assert "mcp_config_snippet" in data

    # 2. List agents
    list_res = await client.get("/api/agents", headers=headers)
    assert list_res.status_code == 200
    assert any(a["id"] == agent_id for a in list_res.json())

    # 3. Issue another credential
    cred_res = await client.post(
        f"/api/agents/{agent_id}/credentials",
        json={"name": "Secondary Key", "expires_in_days": 30},
        headers=headers,
    )
    assert cred_res.status_code == 200
    cred_id = cred_res.json()["id"]

    # 4. Revoke secondary credential
    revoke_res = await client.delete(
        f"/api/agents/{agent_id}/credentials/{cred_id}",
        headers=headers,
    )
    assert revoke_res.status_code == 200

    # 5. Verify agent key authentication
    # Call /api/agent/plan using X-Agent-Key header
    agent_auth_headers = {"X-Agent-Key": raw_token}
    plan_res = await client.post(
        "/api/agent/plan",
        json={"task_prompt": "Translate this SMS to English"},
        headers=agent_auth_headers,
    )
    assert plan_res.status_code == 200
    assert "selected_tools" in plan_res.json()
