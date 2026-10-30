from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.agent import Agent
from app.schemas.execution import AgentPlanRequest, AgentPlanResponse, AgentExecuteRequest, AgentExecuteResponse
from app.services.agent_service import AgentService
from app.services.execution_service import ExecutionService
from app.api.deps import get_authenticated_caller

router = APIRouter(prefix="/agent", tags=["AI Agent Planning & Execution"])


@router.post("/plan", response_model=AgentPlanResponse)
async def plan_task(
    data: AgentPlanRequest,
    caller: tuple = Depends(get_authenticated_caller),
    session: AsyncSession = Depends(get_db),
):
    owner_user, agent = caller
    if data.agent_id and not agent:
        agent = await AgentService.get_agent_by_id(session, data.agent_id)
        if agent and agent.owner_id != owner_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agent does not belong to caller")

    try:
        plan = await ExecutionService.plan_agent_task(
            session=session,
            task_prompt=data.task_prompt,
            agent=agent,
            max_budget=data.max_budget,
            selection_mode=data.selection_mode,
        )
        return plan
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/execute", response_model=AgentExecuteResponse)
async def execute_task(
    data: AgentExecuteRequest,
    caller: tuple = Depends(get_authenticated_caller),
    session: AsyncSession = Depends(get_db),
):
    owner_user, agent = caller
    if data.agent_id and not agent:
        agent = await AgentService.get_agent_by_id(session, data.agent_id)
        if agent and agent.owner_id != owner_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agent does not belong to caller")

    try:
        res = await ExecutionService.execute_agent_task(
            session=session,
            task_prompt=data.task_prompt,
            consumer_user_id=owner_user.id,
            agent=agent,
            approved_tool_ids=data.approved_tool_ids,
            tool_inputs=data.tool_inputs,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
