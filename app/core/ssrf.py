import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple, List

BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),       # Cloud metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.88.99.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),          # Multicast
    ipaddress.ip_network("240.0.0.0/4"),          # Reserved
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),              # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),             # IPv6 Private (ULA)
    ipaddress.ip_network("fe80::/10"),            # IPv6 Link-local
    ipaddress.ip_network("ff00::/8"),             # IPv6 Multicast
]


class SSRFValidationError(ValueError):
    """Raised when an outbound URL violates SSRF security boundaries."""
    pass


def validate_outbound_url(url: str, allow_internal: bool = False) -> str:
    """
    Validate that an outbound URL does not target localhost, private addresses,
    or cloud metadata endpoints (SSRF mitigation).
    """
    if not url:
        raise SSRFValidationError("URL cannot be empty")

    parsed = urlparse(url.strip())

    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFValidationError(f"Invalid URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("URL must include a valid hostname")

    # If explicitly flagged as internal demo mock tool
    if allow_internal:
        return url

    # Block well-known metadata hostnames and loopbacks directly
    lowered = hostname.lower()
    if lowered in ("localhost", "metadata.google.internal", "instance-data", "169.254.169.254"):
        raise SSRFValidationError(f"Access to restricted host '{hostname}' is forbidden")

    # Resolve hostname to all resolved IP addresses
    try:
        addr_infos = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as e:
        raise SSRFValidationError(f"Failed to resolve hostname '{hostname}': {e}")

    for family, _, _, _, sockaddr in addr_infos:
        ip_str = sockaddr[0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            for blocked_net in BLOCKED_NETWORKS:
                if ip_obj in blocked_net:
                    raise SSRFValidationError(
                        f"SSRF Protection: Hostname '{hostname}' resolves to restricted IP address '{ip_str}'."
                    )
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                raise SSRFValidationError(
                    f"SSRF Protection: Hostname '{hostname}' resolves to non-routable/private IP '{ip_str}'."
                )
        except ValueError:
            raise SSRFValidationError(f"Invalid IP address resolved: {ip_str}")

    return url
