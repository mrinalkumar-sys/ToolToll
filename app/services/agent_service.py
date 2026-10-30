from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_agent_key, hash_agent_key
from app.models.agent import Agent, AgentCredential, AgentPermission
from app.models.tool import Tool
from app.models.audit import ToolCall, ToolCallStatus
from app.schemas.agent import AgentCreate, AgentUpdate, PermissionRule


class AgentPermissionError(Exception):
    """Raised when an agent is not authorized to call a specific tool or category."""
    pass


class AgentBudgetExceededError(Exception):
    """Raised when a tool call exceeds the agent's spending limits."""
    pass


class AgentService:
    @staticmethod
    async def get_agent_by_id(session: AsyncSession, agent_id: str) -> Optional[Agent]:
        stmt = select(Agent).where(Agent.id == agent_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def list_user_agents(session: AsyncSession, user_id: str) -> List[Agent]:
        stmt = select(Agent).where(Agent.owner_id == user_id).order_by(Agent.created_at.desc())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_agent(session: AsyncSession, owner_id: str, data: AgentCreate) -> Tuple[Agent, str, AgentCredential]:
        agent = Agent(
            owner_id=owner_id,
            name=data.name,
            description=data.description,
            per_call_limit=data.per_call_limit,
            daily_limit=data.daily_limit,
            monthly_limit=data.monthly_limit,
            auto_approval_max=data.auto_approval_max,
        )
        session.add(agent)
        await session.flush()

        # Create default wildcard permission
        perm = AgentPermission(
            agent_id=agent.id,
            allowed_category="*",
            can_call=True,
        )
        session.add(perm)

        # Generate initial high-entropy credential
        raw_token, key_prefix, hashed_key = generate_agent_key()
        credential = AgentCredential(
            agent_id=agent.id,
            name="Initial Primary Key",
            key_prefix=key_prefix,
            hashed_key=hashed_key,
        )
        session.add(credential)
        await session.commit()
        await session.refresh(agent)
        await session.refresh(credential)
        return agent, raw_token, credential

    @staticmethod
    async def create_credential(
        session: AsyncSession, agent: Agent, name: str, expires_in_days: Optional[int] = None
    ) -> Tuple[str, AgentCredential]:
        raw_token, key_prefix, hashed_key = generate_agent_key()
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

        cred = AgentCredential(
            agent_id=agent.id,
            name=name,
            key_prefix=key_prefix,
            hashed_key=hashed_key,
            expires_at=expires_at,
        )
        session.add(cred)
        await session.commit()
        await session.refresh(cred)
        return raw_token, cred

    @staticmethod
    async def revoke_credential(session: AsyncSession, agent_id: str, credential_id: str) -> bool:
        stmt = select(AgentCredential).where(
            and_(AgentCredential.id == credential_id, AgentCredential.agent_id == agent_id)
        )
        res = await session.execute(stmt)
        cred = res.scalar_one_or_none()
        if not cred:
            return False
        cred.revoked_at = datetime.now(timezone.utc)
        await session.commit()
        return True

    @staticmethod
    async def authenticate_agent_key(session: AsyncSession, raw_token: str) -> Optional[Tuple[Agent, AgentCredential]]:
        hashed = hash_agent_key(raw_token)
        now = datetime.now(timezone.utc)
        stmt = select(AgentCredential).where(
            and_(
                AgentCredential.hashed_key == hashed,
                AgentCredential.revoked_at.is_(None),
            )
        )
        res = await session.execute(stmt)
        cred = res.scalar_one_or_none()
        if not cred:
            return None

        if cred.expires_at and cred.expires_at < now:
            return None

        agent = await AgentService.get_agent_by_id(session, cred.agent_id)
        if not agent or not agent.is_active:
            return None

        return agent, cred

    @staticmethod
    async def verify_permissions_and_budget(
        session: AsyncSession,
        agent: Agent,
        tool: Tool,
        proposed_cost: Decimal,
    ) -> None:
        """Verify agent has permission to call tool and does not breach per-call, daily, or monthly limits."""
        # 1. Per-call limit check
        if proposed_cost > agent.per_call_limit:
            raise AgentBudgetExceededError(
                f"Tool cost ${proposed_cost:.4f} exceeds agent per-call budget limit of ${agent.per_call_limit:.4f}"
            )

        # 2. Permission check
        stmt = select(AgentPermission).where(AgentPermission.agent_id == agent.id)
        res = await session.execute(stmt)
        perms = list(res.scalars().all())

        if perms:
            allowed = False
            for p in perms:
                if not p.can_call:
                    continue
                if p.allowed_tool_id and p.allowed_tool_id == tool.id:
                    allowed = True
                    break
                if p.allowed_category in ("*", tool.category.lower()):
                    allowed = True
                    break
            if not allowed:
                raise AgentPermissionError(
                    f"Agent does not have permission to execute tool '{tool.name}' (Category: {tool.category})"
                )

        # 3. Daily & Monthly spending limits
        now = datetime.now(timezone.utc)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Calculate daily spend
        daily_stmt = select(func.sum(ToolCall.price_charged)).where(
            and_(
                ToolCall.agent_id == agent.id,
                ToolCall.status == ToolCallStatus.SUCCESS,
                ToolCall.created_at >= day_start,
            )
        )
        daily_res = await session.execute(daily_stmt)
        daily_spent = daily_res.scalar() or Decimal("0.0000")

        if daily_spent + proposed_cost > agent.daily_limit:
            raise AgentBudgetExceededError(
                f"Call would exceed agent daily limit of ${agent.daily_limit:.4f} (Spent today: ${daily_spent:.4f})"
            )

        # Calculate monthly spend
        monthly_stmt = select(func.sum(ToolCall.price_charged)).where(
            and_(
                ToolCall.agent_id == agent.id,
                ToolCall.status == ToolCallStatus.SUCCESS,
                ToolCall.created_at >= month_start,
            )
        )
        monthly_res = await session.execute(monthly_stmt)
        monthly_spent = monthly_res.scalar() or Decimal("0.0000")

        if monthly_spent + proposed_cost > agent.monthly_limit:
            raise AgentBudgetExceededError(
                f"Call would exceed agent monthly limit of ${agent.monthly_limit:.4f} (Spent this month: ${monthly_spent:.4f})"
            )
