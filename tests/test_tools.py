import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tool_marketplace_and_registration(client: AsyncClient):
    # 1. Search marketplace (seeded demo tools)
    search_res = await client.get("/api/tools/search?q=translate")
    assert search_res.status_code == 200
    tools = search_res.json()
    assert len(tools) >= 1
    assert any("translator" in t["slug"] for t in tools)

    # 2. Login as creator
    creator_login = await client.post(
        "/api/auth/login",
        json={"email": "creator@tooltoll.io", "password": "CreatorPass123!"},
    )
    creator_token = creator_login.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # 3. SSRF Defense: Registering an internal/private endpoint must be blocked
    ssrf_payload = {
        "name": "Malicious Metadata Exfiltrator",
        "short_desc": "Attempts SSRF against AWS metadata endpoint",
        "category": "utility",
        "base_url": "http://169.254.169.254",
        "endpoint_path": "/latest/meta-data",
        "http_method": "GET",
        "input_schema": {"type": "object"},
        "price_per_call": "0.0100",
    }
    ssrf_res = await client.post("/api/tools", json=ssrf_payload, headers=creator_headers)
    assert ssrf_res.status_code == 400
    assert "SSRF" in ssrf_res.json()["detail"] or "restricted" in ssrf_res.json()["detail"]

    # 4. Valid Tool Registration (using demo mock host)
    valid_payload = {
        "name": "Custom Currency Converter",
        "short_desc": "Converts rates between global currencies",
        "category": "finance",
        "tags": ["finance", "forex", "currency"],
        "base_url": "https://api.internal-demo.tooltoll.io",
        "endpoint_path": "/v1/convert",
        "http_method": "POST",
        "input_schema": {
            "type": "object",
            "properties": {
                "from": {"type": "string"},
                "to": {"type": "string"},
                "amount": {"type": "number"},
            },
            "required": ["from", "to", "amount"],
        },
        "price_per_call": "0.0200",
    }
    reg_res = await client.post("/api/tools", json=valid_payload, headers=creator_headers)
    assert reg_res.status_code == 201
    new_tool = reg_res.json()
    tool_id = new_tool["id"]
    assert new_tool["status"] == "draft"

    # 5. Cannot submit for approval without at least 1 test run
    sub_fail = await client.post(f"/api/tools/{tool_id}/submit", headers=creator_headers)
    assert sub_fail.status_code == 400

    # 6. Run controlled test
    test_res = await client.post(
        f"/api/tools/{tool_id}/test",
        json={"sample_input": {"from": "USD", "to": "EUR", "amount": 100}},
        headers=creator_headers,
    )
    assert test_res.status_code == 200

    # 7. Submit for approval
    sub_ok = await client.post(f"/api/tools/{tool_id}/submit", headers=creator_headers)
    assert sub_ok.status_code == 200
    assert sub_ok.json()["status"] == "pending_approval"

    # 8. Admin Moderation
    admin_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@tooltoll.io", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    pending_res = await client.get("/api/admin/tools/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    assert any(t["id"] == tool_id for t in pending_res.json())

    # Approve
    approve_res = await client.post(
        f"/api/admin/tools/{tool_id}/approve",
        json={"action": "approve", "reason": "Verified and passed"},
        headers=admin_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
