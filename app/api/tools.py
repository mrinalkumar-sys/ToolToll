from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.tool import Tool, ToolStatus, ToolTestRun
from app.schemas.tool import ToolCreate, ToolUpdate, ToolResponse, ToolTestRequest, ToolTestResponse
from app.schemas.execution import ToolCallRequest, ToolCallResponse
from app.services.tool_service import ToolService
from app.services.execution_service import ExecutionService
from app.api.deps import get_current_user, get_authenticated_caller

router = APIRouter(prefix="/tools", tags=["Tools Marketplace & Registration"])


@router.get("", response_model=List[ToolResponse])
async def list_tools(
    category: Optional[str] = None,
    mine: bool = False,
    current_user: Optional[User] = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if mine and current_user:
        stmt = select(Tool).where(Tool.creator_id == current_user.id).order_by(Tool.created_at.desc())
        res = await session.execute(stmt)
        return [ToolResponse.model_validate(t) for t in res.scalars().all()]

    tools = await ToolService.search_tools(session, category=category, only_approved=True)
    return [ToolResponse.model_validate(t) for t in tools]


@router.get("/search", response_model=List[ToolResponse])
async def search_marketplace(
    q: Optional[str] = Query(None, description="Search query string"),
    category: Optional[str] = Query(None, description="Filter by category"),
    max_price: Optional[Decimal] = Query(None, description="Maximum price per call"),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
):
    tools = await ToolService.search_tools(
        session, query=q, category=category, max_price=max_price, only_approved=True, limit=limit
    )
    return [ToolResponse.model_validate(t) for t in tools]


@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(
    tool_id: str,
    session: AsyncSession = Depends(get_db),
):
    tool = await ToolService.get_tool_by_id(session, tool_id)
    if not tool:
        tool = await ToolService.get_tool_by_slug(session, tool_id)
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return ToolResponse.model_validate(tool)


@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def register_tool(
    data: ToolCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    try:
        tool = await ToolService.create_tool(session, current_user.id, data)
        return ToolResponse.model_validate(tool)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{tool_id}", response_model=ToolResponse)
async def update_tool(
    tool_id: str,
    data: ToolUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    tool = await ToolService.get_tool_by_id(session, tool_id)
    if not tool or tool.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found or access denied")

    try:
        updated = await ToolService.update_tool(session, tool, data)
        return ToolResponse.model_validate(updated)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{tool_id}/test", response_model=ToolTestResponse)
async def test_tool_endpoint(
    tool_id: str,
    data: ToolTestRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    tool = await ToolService.get_tool_by_id(session, tool_id)
    if not tool or tool.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found or access denied")

    test_run = await ToolService.test_tool(session, tool, data.sample_input)
    return ToolTestResponse(
        is_successful=test_run.is_successful,
        response_status=test_run.response_status,
        response_body=test_run.response_body,
        latency_ms=test_run.latency_ms,
        error_message=test_run.error_message,
    )


@router.post("/{tool_id}/submit")
async def submit_tool_for_approval(
    tool_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    tool = await ToolService.get_tool_by_id(session, tool_id)
    if not tool or tool.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found or access denied")

    # Verify at least one successful test run
    stmt = select(ToolTestRun).where(ToolTestRun.tool_id == tool.id, ToolTestRun.is_successful == True)
    res = await session.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tool cannot be submitted without at least one successful verified test run",
        )

    tool.status = ToolStatus.PENDING_APPROVAL
    await session.commit()
    return {"message": "Tool submitted for moderation successfully", "status": tool.status.value}


@router.post("/{tool_id}/calls", response_model=ToolCallResponse)
async def call_paid_tool(
    tool_id: str,
    data: ToolCallRequest,
    caller: tuple = Depends(get_authenticated_caller),
    session: AsyncSession = Depends(get_db),
):
    owner_user, agent = caller
    try:
        call_record = await ExecutionService.execute_paid_tool(
            session=session,
            tool_id=tool_id,
            input_data=data.input_data,
            idempotency_key=data.idempotency_key,
            consumer_user_id=owner_user.id,
            agent=agent,
        )
        tool = await ToolService.get_tool_by_id(session, call_record.tool_id)
        return ToolCallResponse(
            call_id=call_record.id,
            tool_id=call_record.tool_id,
            tool_name=tool.name if tool else "Unknown Tool",
            status=call_record.status,
            response_output=call_record.response_output,
            duration_ms=call_record.duration_ms,
            price_charged=call_record.price_charged,
            quality_status=call_record.quality_status,
            reversal_reason=call_record.reversal_reason,
            created_at=call_record.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
