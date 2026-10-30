from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.agent import Agent, AgentCredential, AgentPermission
from app.schemas.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    CredentialCreate,
    CredentialCreatedResponse,
    CredentialSummary,
    PermissionUpdate,
    PermissionResponse,
)
from app.services.agent_service import AgentService
from app.api.deps import get_current_user

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_agent(
    data: AgentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent, raw_token, credential = await AgentService.create_agent(session, current_user.id, data)
    return {
        "agent": AgentResponse.model_validate(agent),
        "initial_credential": {
            "id": credential.id,
            "name": credential.name,
            "key_prefix": credential.key_prefix,
            "raw_token": raw_token,
            "created_at": credential.created_at,
        },
        "mcp_config_snippet": {
            "mcpServers": {
                "tooltoll": {
                    "command": "python",
                    "args": ["-m", "app.mcp_server"],
                    "env": {
                        "TOOLTOLL_AGENT_KEY": raw_token,
                        "TOOLTOLL_API_URL": "http://localhost:8000/api",
                    },
                }
            }
        },
    }


@router.get("", response_model=List[AgentResponse])
async def list_agents(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agents = await AgentService.list_user_agents(session, current_user.id)
    return [AgentResponse.model_validate(a) for a in agents]


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return AgentResponse.model_validate(agent)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(agent, k, v)

    await session.commit()
    await session.refresh(agent)
    return AgentResponse.model_validate(agent)


@router.get("/{agent_id}/credentials", response_model=List[CredentialSummary])
async def list_credentials(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    stmt = select(AgentCredential).where(AgentCredential.agent_id == agent.id).order_by(AgentCredential.created_at.desc())
    res = await session.execute(stmt)
    return [CredentialSummary.model_validate(c) for c in res.scalars().all()]


@router.post("/{agent_id}/credentials", response_model=CredentialCreatedResponse)
async def issue_credential(
    agent_id: str,
    data: CredentialCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    raw_token, cred = await AgentService.create_credential(session, agent, data.name, data.expires_in_days)
    return CredentialCreatedResponse(
        id=cred.id,
        agent_id=cred.agent_id,
        name=cred.name,
        key_prefix=cred.key_prefix,
        raw_token=raw_token,
        expires_at=cred.expires_at,
        created_at=cred.created_at,
    )


@router.delete("/{agent_id}/credentials/{credential_id}")
async def revoke_credential(
    agent_id: str,
    credential_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    revoked = await AgentService.revoke_credential(session, agent_id, credential_id)
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    return {"message": "Agent credential successfully revoked"}


@router.get("/{agent_id}/permissions", response_model=List[PermissionResponse])
async def get_permissions(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    stmt = select(AgentPermission).where(AgentPermission.agent_id == agent.id)
    res = await session.execute(stmt)
    return [PermissionResponse.model_validate(p) for p in res.scalars().all()]


@router.put("/{agent_id}/permissions", response_model=List[PermissionResponse])
async def update_permissions(
    agent_id: str,
    data: PermissionUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    agent = await AgentService.get_agent_by_id(session, agent_id)
    if not agent or agent.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Clear existing permissions
    stmt_del = select(AgentPermission).where(AgentPermission.agent_id == agent.id)
    res = await session.execute(stmt_del)
    for p in res.scalars().all():
        await session.delete(p)

    new_perms = []
    for rule in data.permissions:
        perm = AgentPermission(
            agent_id=agent.id,
            allowed_category=rule.allowed_category,
            allowed_tool_id=rule.allowed_tool_id,
            can_call=rule.can_call,
        )
        session.add(perm)
        new_perms.append(perm)

    await session.commit()
    for p in new_perms:
        await session.refresh(p)

    return [PermissionResponse.model_validate(p) for p in new_perms]
