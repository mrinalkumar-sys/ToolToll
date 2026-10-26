import pytest
from app.core.exceptions import SSRFSecurityError
from app.security.input_safety import validate_endpoint_url_safety, sanitize_prompt_text
from app.security.internal_auth import AuthenticatedCaller


def test_ssrf_rejects_loopback():
    with pytest.raises(SSRFSecurityError) as exc:
        validate_endpoint_url_safety("http://127.0.0.1:8080/test")
    assert "blocked" in str(exc.value).lower() or "forbidden" in str(exc.value).lower()


def test_ssrf_rejects_private_class_a():
    with pytest.raises(SSRFSecurityError) as exc:
        validate_endpoint_url_safety("http://10.0.0.5/api/data")
    assert "blocked" in str(exc.value).lower()


def test_ssrf_rejects_cloud_metadata():
    with pytest.raises(SSRFSecurityError) as exc:
        validate_endpoint_url_safety("http://169.254.169.254/latest/meta-data/")
    assert "blocked" in str(exc.value).lower()


def test_ssrf_rejects_disallowed_schemes():
    with pytest.raises(SSRFSecurityError) as exc:
        validate_endpoint_url_safety("ftp://api.example.com/data")
    assert "prohibited url scheme" in str(exc.value).lower()

    with pytest.raises(SSRFSecurityError) as exc:
        validate_endpoint_url_safety("file:///etc/passwd")
    assert "prohibited url scheme" in str(exc.value).lower()


def test_ssrf_accepts_valid_public_domain():
    # Should not raise
    validate_endpoint_url_safety("https://api.github.com/users")


def test_sanitize_prompt_text():
    raw = "Hello\x00World! " + ("A" * 20000)
    sanitized = sanitize_prompt_text(raw, max_chars=100)
    assert "\x00" not in sanitized
    assert len(sanitized) == 100


def test_authenticated_caller_headers():
    caller = AuthenticatedCaller(agent_key="test-key-123", bearer_token=None)
    headers = caller.to_forward_headers()
    assert headers["X-Agent-Key"] == "test-key-123"
    assert "Authorization" not in headers

    caller_jwt = AuthenticatedCaller(bearer_token="jwt-token-456")
    headers_jwt = caller_jwt.to_forward_headers()
    assert headers_jwt["Authorization"] == "Bearer jwt-token-456"
