import ipaddress
import socket
from urllib.parse import urlparse
from app.core.config import settings
from app.core.exceptions import SSRFSecurityError
from app.core.logging import logger

# Blocked IP networks
BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # AWS/GCP/Azure link-local metadata
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),    # Multicast
    ipaddress.ip_network("240.0.0.0/4"),    # Reserved
    ipaddress.ip_network("::1/128"),        # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),       # IPv6 private
    ipaddress.ip_network("fe80::/10"),      # IPv6 link-local
]


def validate_endpoint_url_safety(url: str) -> None:
    """
    Validates that a URL does not resolve to loopback, private RFC-1918,
    or cloud metadata IP addresses (SSRF prevention).
    """
    if not url:
        raise SSRFSecurityError("Endpoint URL cannot be empty")

    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFSecurityError(f"Prohibited URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted.")

    if not parsed.hostname:
        raise SSRFSecurityError("Invalid URL: hostname could not be parsed.")

    hostname = parsed.hostname.strip()

    # In test mode or when ALLOW_PRIVATE_IPS_FOR_TESTS is True, permit localhost
    if settings.ALLOW_PRIVATE_IPS_FOR_TESTS:
        return

    # Check literal IP address
    try:
        ip = ipaddress.ip_address(hostname)
        for net in BLOCKED_NETWORKS:
            if ip in net:
                raise SSRFSecurityError(f"Access to private/internal IP address '{ip}' is blocked.")
        return
    except ValueError:
        # Not a raw IP literal, proceed to DNS resolution
        pass

    # Resolve hostname via DNS
    try:
        resolved_ips = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise SSRFSecurityError(f"Failed to resolve hostname '{hostname}': {e}")

    for item in resolved_ips:
        ip_str = item[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
            for net in BLOCKED_NETWORKS:
                if ip in net:
                    raise SSRFSecurityError(
                        f"SSRF violation: Hostname '{hostname}' resolves to forbidden address '{ip_str}'."
                    )
        except ValueError:
            continue


def sanitize_prompt_text(text: str, max_chars: int = 10000) -> str:
    """
    Sanitizes untrusted text input to guard against buffer exhaustion
    and null-byte injections.
    """
    if not text:
        return ""
    sanitized = text.replace("\x00", "").strip()
    return sanitized[:max_chars]
