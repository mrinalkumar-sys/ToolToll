from typing import Optional, Tuple
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.models.agent import Agent, AgentCredential
from app.services.agent_service import AgentService

security_bearer = HTTPBearer(auto_error=False)
agent_key_header = APIKeyHeader(name="X-Agent-Key", auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    stmt = select(User).where(User.id == user_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated",
        )

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required",
        )
    return current_user


async def get_authenticated_caller(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    raw_agent_key: Optional[str] = Security(agent_key_header),
    session: AsyncSession = Depends(get_db),
) -> Tuple[User, Optional[Agent]]:
    """
    Dual Authentication Resolver:
    Resolves caller either via:
    1. Agent API Key (X-Agent-Key header) -> derives Owner User and Agent identity
    2. User JWT Bearer token -> direct Consumer User session
    """
    if raw_agent_key:
        auth_result = await AgentService.authenticate_agent_key(session, raw_agent_key)
        if not auth_result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or revoked Agent Key",
            )
        agent, _ = auth_result
        stmt = select(User).where(User.id == agent.owner_id)
        res = await session.execute(stmt)
        owner = res.scalar_one_or_none()
        if not owner or not owner.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Agent owner account is disabled",
            )
        return owner, agent

    # Fallback to User Bearer
    if credentials:
        user = await get_current_user(credentials, session)
        return user, None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide either 'Authorization: Bearer <token>' or 'X-Agent-Key: <key>'",
    )
