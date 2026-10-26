import hmac
from typing import Optional, Tuple
from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from app.core.config import settings
from app.core.logging import logger

security_bearer = HTTPBearer(auto_error=False)
agent_key_header = APIKeyHeader(name="X-Agent-Key", auto_error=False)
internal_key_header = APIKeyHeader(name="X-Internal-Service-Key", auto_error=False)


class AuthenticatedCaller:
    """Represents the validated credentials of an agent or user."""
    def __init__(
        self,
        agent_key: Optional[str] = None,
        bearer_token: Optional[str] = None,
        is_internal: bool = False,
    ):
        self.agent_key = agent_key
        self.bearer_token = bearer_token
        self.is_internal = is_internal

    @property
    def is_authenticated(self) -> bool:
        return bool(self.agent_key or self.bearer_token or self.is_internal)

    def to_forward_headers(self) -> dict:
        """Returns the auth headers to forward to the ToolToll main backend."""
        headers = {}
        if self.agent_key:
            headers["X-Agent-Key"] = self.agent_key
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"
        if self.is_internal:
            headers["X-Internal-Service-Key"] = settings.INTERNAL_SERVICE_KEY
        return headers


async def require_internal_service(
    internal_key: Optional[str] = Security(internal_key_header)
) -> None:
    """
    Enforces that the request originated from the trusted main ToolToll backend.
    """
    if not internal_key or not hmac.compare_digest(internal_key, settings.INTERNAL_SERVICE_KEY):
        logger.warning("Unauthorized internal service attempt with invalid X-Internal-Service-Key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Internal-Service-Key header"
        )


async def get_caller_identity(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    agent_key: Optional[str] = Security(agent_key_header),
    internal_key: Optional[str] = Security(internal_key_header)
) -> AuthenticatedCaller:
    """
    Resolves caller identity from incoming headers:
    1. Internal service key (trusted inter-service communication)
    2. Agent API Key (X-Agent-Key header)
    3. User JWT token (Bearer authentication)
    """
    is_internal = bool(
        internal_key and hmac.compare_digest(internal_key, settings.INTERNAL_SERVICE_KEY)
    )

    bearer_token = credentials.credentials if credentials else None

    if not (agent_key or bearer_token or is_internal):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide 'X-Agent-Key', 'Authorization: Bearer <token>', or 'X-Internal-Service-Key'."
        )

    return AuthenticatedCaller(
        agent_key=agent_key,
        bearer_token=bearer_token,
        is_internal=is_internal
    )
