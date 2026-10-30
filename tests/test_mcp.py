import os
import json
import pytest
from httpx import AsyncClient
from mcp_server import (
    search_tools,
    get_tool_details,
    get_tool_price,
    get_wallet_balance,
    call_paid_tool,
)


@pytest.mark.asyncio
async def test_mcp_tools_discovery_and_call(client: AsyncClient):
    # 1. MCP Discovery test (doesn't require agent key)
    tools_json = await search_tools(query="translator")
    tools = json.loads(tools_json)
    assert len(tools) >= 1
    assert "slug" in tools[0]
    tool_id = tools[0]["tool_id"]

    # 2. Get tool details
    details_json = await get_tool_details(tool_id)
    details = json.loads(details_json)
    assert details["tool_id"] == tool_id
    assert "input_json_schema" in details

    # 3. Get tool price
    price_json = await get_tool_price(tool_id)
    price_info = json.loads(price_json)
    assert "authoritative_price_usd" in price_info

    # 4. Create an agent to obtain valid agent key
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "consumer@tooltoll.io", "password": "ConsumerPass123!"},
    )
    token = login_res.json()["access_token"]
    create_agent_res = await client.post(
        "/api/agents",
        json={"name": "MCP Test Agent", "per_call_limit": "1.0000"},
        headers={"Authorization": f"Bearer {token}"},
    )
    agent_data = create_agent_res.json()
    raw_token = agent_data["initial_credential"]["raw_token"]

    # Set environment variable for MCP context
    os.environ["TOOLTOLL_AGENT_KEY"] = raw_token

    # 5. Check wallet balance via MCP
    bal_json = await get_wallet_balance()
    bal_data = json.loads(bal_json)
    assert "available_balance_usd" in bal_data

    # 6. Call paid tool via MCP
    call_res_json = await call_paid_tool(
        tool_id=tool_id,
        input_json=json.dumps({"text": "Hello world", "target_language": "fr"}),
        idempotency_key="mcp_test_call_001",
    )
    call_res = json.loads(call_res_json)
    assert call_res["status"] == "success"
    assert "output" in call_res
