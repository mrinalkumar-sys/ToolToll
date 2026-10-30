import os
import sys
import json
import uuid
import asyncio
import argparse
from decimal import Decimal
from typing import Optional, Dict, Any, List

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp.server.mcpserver import MCPServer
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.tool import Tool, ToolStatus
from app.models.audit import ToolCall
from app.models.wallet import Wallet
from app.services.tool_service import ToolService
from app.services.agent_service import AgentService
from app.services.execution_service import ExecutionService
from app.services.ledger_service import LedgerService

mcp = MCPServer(
    name="ToolToll MCP Server",
    version="1.0.0",
    description="ToolToll Model Context Protocol (MCP) server for discovering and calling paid APIs."
)


async def _get_auth_context():
    """Resolve caller user and agent from TOOLTOLL_AGENT_KEY."""
    agent_key = os.environ.get("TOOLTOLL_AGENT_KEY", "").strip()
    if not agent_key:
        raise ValueError(
            "TOOLTOLL_AGENT_KEY environment variable is not configured. "
            "Please provide an agent credential key generated in the ToolToll Agent Management Dashboard."
        )

    async with AsyncSessionLocal() as session:
        auth_res = await AgentService.authenticate_agent_key(session, agent_key)
        if not auth_res:
            raise PermissionError("Invalid, expired, or revoked Agent Key")
        agent, cred = auth_res
        return agent.owner_id, agent.id


@mcp.tool()
async def search_tools(
    query: str = "",
    category: str = "",
    max_price: Optional[float] = None,
    limit: int = 10,
) -> str:
    """
    Search and discover approved paid APIs in the ToolToll marketplace.
    Returns JSON list of matching tools with descriptions, price per call, and measured reliability.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        max_p = Decimal(str(max_price)) if max_price is not None else None
        tools = await ToolService.search_tools(
            session=session,
            query=query if query else None,
            category=category if category else None,
            max_price=max_p,
            only_approved=True,
            limit=limit,
        )
        results = []
        for t in tools:
            rel = (t.success_calls / t.total_calls) if t.total_calls > 0 else 1.0
            results.append({
                "tool_id": t.id,
                "name": t.name,
                "slug": t.slug,
                "category": t.category,
                "short_description": t.short_desc,
                "price_per_call_usd": str(t.price_per_call),
                "measured_reliability": f"{rel * 100:.1f}%",
                "average_latency_ms": f"{t.average_latency_ms:.0f}ms",
                "tags": t.tags,
            })
        return json.dumps(results, indent=2)


@mcp.tool()
async def get_tool_details(tool_id: str) -> str:
    """
    Get detailed schema, parameters, and description for a specific ToolToll API.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        tool = await ToolService.get_tool_by_id(session, tool_id)
        if not tool:
            tool = await ToolService.get_tool_by_slug(session, tool_id)
        if not tool:
            return json.dumps({"error": f"Tool '{tool_id}' not found in ToolToll registry"})

        return json.dumps({
            "tool_id": tool.id,
            "name": tool.name,
            "slug": tool.slug,
            "category": tool.category,
            "short_desc": tool.short_desc,
            "detailed_desc": tool.detailed_desc,
            "price_per_call": str(tool.price_per_call),
            "currency": tool.currency,
            "input_json_schema": tool.input_schema,
            "output_json_schema": tool.output_schema,
            "rate_limit_per_minute": tool.rate_limit_per_minute,
            "terms_of_use": tool.terms_of_use,
        }, indent=2)


@mcp.tool()
async def get_tool_price(tool_id: str) -> str:
    """
    Get the authoritative verified price for a ToolToll API.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        tool = await ToolService.get_tool_by_id(session, tool_id)
        if not tool:
            tool = await ToolService.get_tool_by_slug(session, tool_id)
        if not tool:
            return json.dumps({"error": f"Tool '{tool_id}' not found"})
        return json.dumps({
            "tool_id": tool.id,
            "tool_name": tool.name,
            "authoritative_price_usd": str(tool.price_per_call),
            "currency": tool.currency,
        })


@mcp.tool()
async def get_wallet_balance() -> str:
    """
    Check the current available wallet balance and reserved funds for this authenticated agent's owner.
    """
    await init_db()
    owner_id, _ = await _get_auth_context()
    async with AsyncSessionLocal() as session:
        wallet = await LedgerService.get_or_create_wallet(session, owner_id)
        return json.dumps({
            "available_balance_usd": str(wallet.available_balance),
            "total_balance_usd": str(wallet.balance),
            "reserved_funds_usd": str(wallet.reserved_balance),
            "currency": wallet.currency,
        })


@mcp.tool()
async def call_paid_tool(
    tool_id: str,
    input_json: str,
    idempotency_key: str = "",
) -> str:
    """
    Execute a paid ToolToll API call subject to permissions, balance, and budget limits.
    Charges the owner's wallet according to the authoritative price.
    """
    await init_db()
    owner_id, agent_id = await _get_auth_context()

    try:
        input_data = json.loads(input_json) if isinstance(input_json, str) else input_json
    except Exception as e:
        return json.dumps({"error": f"Invalid input JSON: {e}"})

    idem_key = idempotency_key or f"mcp_{uuid.uuid4().hex[:16]}"

    async with AsyncSessionLocal() as session:
        agent = await AgentService.get_agent_by_id(session, agent_id)
        try:
            call_record = await ExecutionService.execute_paid_tool(
                session=session,
                tool_id=tool_id,
                input_data=input_data,
                idempotency_key=idem_key,
                consumer_user_id=owner_id,
                agent=agent,
            )
            return json.dumps({
                "call_id": call_record.id,
                "tool_id": call_record.tool_id,
                "status": call_record.status.value,
                "price_charged_usd": str(call_record.price_charged),
                "duration_ms": f"{call_record.duration_ms:.0f}ms",
                "quality_status": call_record.quality_status.value,
                "output": call_record.response_output,
            }, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})


@mcp.tool()
async def get_call_status(call_id: str) -> str:
    """
    Inspect the execution status, output, and billing details for a past paid call.
    """
    await init_db()
    owner_id, _ = await _get_auth_context()
    async with AsyncSessionLocal() as session:
        stmt = select(ToolCall).where(ToolCall.id == call_id)
        res = await session.execute(stmt)
        call = res.scalar_one_or_none()
        if not call or call.user_id != owner_id:
            return json.dumps({"error": "Call record not found or access denied"})

        return json.dumps({
            "call_id": call.id,
            "tool_id": call.tool_id,
            "status": call.status.value,
            "price_charged_usd": str(call.price_charged),
            "quality_status": call.quality_status.value,
            "duration_ms": call.duration_ms,
            "output": call.response_output,
            "created_at": str(call.created_at),
        }, indent=2)


@mcp.tool()
async def get_usage_history(limit: int = 10) -> str:
    """
    Get recent paid tool call history and charges for this agent.
    """
    await init_db()
    owner_id, agent_id = await _get_auth_context()
    async with AsyncSessionLocal() as session:
        stmt = (
            select(ToolCall)
            .where(ToolCall.agent_id == agent_id)
            .order_by(ToolCall.created_at.desc())
            .limit(limit)
        )
        res = await session.execute(stmt)
        calls = res.scalars().all()
        results = []
        for c in calls:
            results.append({
                "call_id": c.id,
                "tool_id": c.tool_id,
                "status": c.status.value,
                "price_charged_usd": str(c.price_charged),
                "duration_ms": f"{c.duration_ms:.0f}ms",
                "created_at": str(c.created_at),
            })
        return json.dumps(results, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ToolToll MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse", "http"], default="stdio")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    if args.transport == "stdio":
        asyncio.run(mcp.run_stdio_async())
    elif args.transport == "sse":
        asyncio.run(mcp.run_sse_async(port=args.port))
    elif args.transport == "http":
        asyncio.run(mcp.run_streamable_http_async(port=args.port))
