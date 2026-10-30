from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.audit import ToolCallStatus, QualityStatus


class ToolCallRequest(BaseModel):
    tool_id: str
    input_data: Dict[str, Any]
    idempotency_key: str = Field(description="Client unique idempotency key to prevent double charging")


class ToolCallResponse(BaseModel):
    call_id: str
    tool_id: str
    tool_name: str
    status: ToolCallStatus
    response_output: Optional[Any]
    duration_ms: float
    price_charged: Decimal
    quality_status: QualityStatus
    reversal_reason: Optional[str] = None
    created_at: datetime


class AgentPlanRequest(BaseModel):
    agent_id: Optional[str] = None
    task_prompt: str = Field(min_length=3, description="Natural language task description")
    max_budget: Optional[Decimal] = Field(default=None, ge=0)
    selection_mode: str = Field(default="deterministic", description="'deterministic' or 'llm'")


class ToolPlanItem(BaseModel):
    tool_id: str
    tool_name: str
    category: str
    price_per_call: Decimal
    selection_reason: str
    input_parameters: Dict[str, Any]
    measured_reliability: float


class AgentPlanResponse(BaseModel):
    task: str
    selection_mode: str
    plan_explanation: str
    selected_tools: List[ToolPlanItem]
    estimated_total_cost: Decimal
    requires_human_approval: bool
    approval_reason: Optional[str] = None


class AgentExecuteRequest(BaseModel):
    agent_id: Optional[str] = None
    task_prompt: str
    selection_mode: str = "deterministic"
    approved_tool_ids: Optional[List[str]] = None
    tool_inputs: Optional[Dict[str, Dict[str, Any]]] = None  # tool_id -> input dict override


class ExecutionStepResult(BaseModel):
    tool_id: str
    tool_name: str
    price_charged: Decimal
    duration_ms: float
    status: ToolCallStatus
    quality_status: QualityStatus
    output: Optional[Any]
    error: Optional[str] = None


class AgentExecuteResponse(BaseModel):
    task: str
    success: bool
    final_summary: str
    executed_steps: List[ExecutionStepResult]
    total_cost: Decimal
    ledger_committed: bool
