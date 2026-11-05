import urllib.request
import urllib.parse
import json
import subprocess
import sys

BASE_URL = "http://localhost:8001/api"

def make_request(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"raw": err_body}

def run_tests():
    print("==================================================")
    print("ToolToll PayPal Sandbox Gateway Integration Tests")
    print("==================================================")

    # Test 1: Public PayPal Config
    print("\n[Test 1] GET /api/paypal/config")
    status, res = make_request("GET", "/paypal/config")
    assert status == 200, f"Expected 200, got {status}"
    assert res["success"] is True
    cfg = res["data"]
    assert "clientId" in cfg and cfg["clientId"].startswith("BAA"), "Invalid Client ID"
    assert cfg["mode"] == "sandbox", f"Expected sandbox mode, got {cfg['mode']}"
    assert cfg["currency"] == "USD"
    assert "clientSecret" not in cfg, "SECURITY VIOLATION: clientSecret leaked in config!"
    print(f"  PASS: Received public config for clientId: {cfg['clientId'][:12]}... (mode: {cfg['mode']})")

    # Test 2: Unauthenticated create-order should be rejected
    print("\n[Test 2] POST /api/paypal/create-order without auth token")
    status, res = make_request("POST", "/paypal/create-order", {"amount": 10.00})
    assert status == 401, f"Expected 401, got {status}"
    print(f"  PASS: Correctly rejected with HTTP {status}: {res['error']['message']}")

    # Authenticate consumer
    print("\n[Auth] Login consumer@tooltoll.com")
    status, login_res = make_request("POST", "/auth/login", {"email": "consumer@tooltoll.com", "password": "Password123!"})
    assert status == 200, "Consumer login failed"
    token = login_res["data"]["token"]
    consumer_id = login_res["data"]["user"]["id"]
    print(f"  PASS: Authenticated consumer ID: {consumer_id}")

    # Test 3: Invalid amounts validation
    print("\n[Test 3] Server-side amount validation (Reject invalid amounts)")
    for bad_amt in [0, -10, 0.49, 15000]:
        status, res = make_request("POST", "/paypal/create-order", {"amount": bad_amt}, token=token)
        assert status == 400, f"Expected 400 for amount {bad_amt}, got {status}"
        print(f"  PASS: Amount {bad_amt} rejected with: {res['error']['message']}")

    # Test 4: Create real PayPal Sandbox order
    print("\n[Test 4] POST /api/paypal/create-order (Create Order on PayPal Sandbox)")
    deposit_amount = 20.00
    status, order_res = make_request("POST", "/paypal/create-order", {"amount": deposit_amount}, token=token)
    assert status == 200, f"Expected 200, got {status}: {order_res}"
    assert order_res["success"] is True
    order_data = order_res["data"]
    order_id = order_data["orderId"]
    internal_id = order_data["id"]
    approval_url = order_data["approvalUrl"]
    assert order_id.isalnum(), f"Invalid PayPal orderId: {order_id}"
    assert approval_url.startswith("https://www.sandbox.paypal.com/checkoutnow"), f"Invalid approvalUrl: {approval_url}"
    assert order_data["amount"] == "20.00"
    assert order_data["currency"] == "USD"
    assert order_data["status"] == "CREATED"
    print(f"  PASS: Order created on PayPal Sandbox!")
    print(f"        Internal Order ID: {internal_id}")
    print(f"        PayPal Order ID:   {order_id}")
    print(f"        Approval URL:      {approval_url}")

    # Test 5: Verify Order in Database
    print("\n[Test 5] Verify order persistence in PostgreSQL database")
    sql = f"SELECT id, \"userId\", \"orderId\", \"amountUsd\", currency, status FROM paypal_orders WHERE \"orderId\" = '{order_id}';"
    p = subprocess.run(
        ["docker", "exec", "-i", "tooltoll-postgres", "psql", "-U", "tooltoll_user", "-d", "tooltoll_db"],
        input=sql.encode("utf-8"),
        capture_output=True
    )
    db_out = p.stdout.decode()
    assert order_id in db_out, "Order not found in database!"
    assert "CREATED" in db_out, "Order status in DB is not CREATED!"
    assert "20.00" in db_out, "Order amount in DB is not 20.00!"
    print(f"  PASS: Verified record in paypal_orders table with status CREATED")

    # Test 6: Get Order status & sync with PayPal Sandbox
    print("\n[Test 6] GET /api/paypal/order/:orderId")
    status, get_res = make_request("GET", f"/paypal/order/{order_id}", token=token)
    assert status == 200, f"Expected 200, got {status}: {get_res}"
    assert get_res["success"] is True
    details = get_res["data"]
    assert details["orderId"] == order_id
    assert details["amount"] == "20.00"
    assert details["paypalStatus"] == "CREATED"
    print(f"  PASS: Order retrieved. Status verified against PayPal Sandbox: {details['paypalStatus']}")

    # Test 7: Cancellation flow
    print("\n[Test 7] POST /api/paypal/cancel-order")
    status, cancel_res = make_request("POST", "/paypal/cancel-order", {"orderId": order_id}, token=token)
    assert status == 200, f"Expected 200, got {status}: {cancel_res}"
    assert cancel_res["data"]["status"] == "CANCELLED"
    print(f"  PASS: Order {order_id} marked as CANCELLED")

    # Test 8: Protection against capturing cancelled orders
    print("\n[Test 8] Prevent capture on cancelled order")
    status, cap_res = make_request("POST", "/paypal/capture-order", {"orderId": order_id}, token=token)
    assert status == 400, f"Expected 400, got {status}"
    assert "cancelled" in cap_res["error"]["message"].lower()
    print(f"  PASS: Cancelled order capture blocked: {cap_res['error']['message']}")

    # Test 9: Cross-user permission authorization
    print("\n[Test 9] Cross-user authorization check (User B cannot capture User A's order)")
    # Login creator
    status, creator_login = make_request("POST", "/auth/login", {"email": "creator@tooltoll.com", "password": "Password123!"})
    creator_token = creator_login["data"]["token"]
    status, cap_res2 = make_request("POST", "/paypal/capture-order", {"orderId": order_id}, token=creator_token)
    assert status == 403, f"Expected 403 FORBIDDEN, got {status}"
    print(f"  PASS: Blocked unauthorized capture with HTTP 403: {cap_res2['error']['message']}")

    # Test 10: Legacy route aliases compatibility
    print("\n[Test 10] Legacy Route Aliases (/api/paypal/orders & /orders/:id)")
    status, alias_order = make_request("POST", "/paypal/orders", {"amountUsd": "10.00"}, token=token)
    assert status == 200, f"Expected 200 on /orders alias, got {status}"
    alias_id = alias_order["data"]["orderId"]
    status, alias_get = make_request("GET", f"/paypal/orders/{alias_id}", token=token)
    assert status == 200, f"Expected 200 on /orders/:id alias, got {status}"
    print(f"  PASS: Both /create-order and /orders alias routes are fully functional")

    print("\n==================================================")
    print("ALL 10 TESTS PASSED SUCCESSFULLY! (100% SUCCESS)")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
