from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DemoAgentRunRequest(BaseModel):
    task_prompt: str = Field(min_length=3, description="Task prompt for the demo agent")
    max_budget_usd: Optional[float] = Field(default=2.0, ge=0.0, description="Budget cap in USD")
    tool_inputs_override: Optional[Dict[str, Dict[str, Any]]] = Field(
        default=None,
        description="Optional manual inputs for specific tool IDs"
    )


class StepExecutionDetail(BaseModel):
    step_id: str
    tool_id: str
    tool_name: str
    call_id: str
    status: str
    price_charged: float
    price_micro_dollars: int
    duration_ms: float
    output: Optional[Any] = None
    quality_verdict: str
    quality_reason: Optional[str] = None
    refund_recommended: bool = False
    error: Optional[str] = None


class DemoAgentRunResponse(BaseModel):
    task: str
    success: bool
    final_summary: str
    total_cost_usd: float
    total_cost_micro_dollars: int
    executed_steps: List[StepExecutionDetail]
    tools_discovered_count: int
    gateway_verified: bool
