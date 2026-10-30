import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_registration_and_login(client: AsyncClient):
    # 1. Register new consumer
    reg_payload = {
        "email": "newconsumer@example.com",
        "password": "SecurePassword123!",
        "full_name": "Test Consumer",
        "role": "consumer",
    }
    res = await client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "newconsumer@example.com"

    # 2. Duplicate registration should fail
    dup_res = await client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 400

    # 3. Login with correct password
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "newconsumer@example.com", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 4. Access /me endpoint
    me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "newconsumer@example.com"

    # 5. Login with invalid password
    bad_login = await client.post(
        "/api/auth/login",
        json={"email": "newconsumer@example.com", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401
