from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PlanStep(BaseModel):
    step_id: str = Field(description="Unique step identifier e.g. 'step_1', 'step_2'")
    tool_id: str = Field(description="Registered tool ID from the approved catalog")
    tool_name: str = Field(description="Name of the selected tool")
    explanation: str = Field(description="Why this step is necessary")
    input_parameters: Dict[str, Any] = Field(description="Input parameters conforming to tool input schema")
    depends_on_step_ids: List[str] = Field(default_factory=list, description="IDs of preceding steps that must complete first")
    estimated_cost_usd: float = Field(ge=0, description="Authoritative price per call in USD")


class LLMPlanOutput(BaseModel):
    is_achievable: bool = Field(description="Whether the task can be solved using the available tool catalog")
    impossibility_reason: Optional[str] = Field(default=None, description="Explanation if task is not achievable")
    plan_explanation: str = Field(description="Overview of the execution strategy")
    steps: List[PlanStep] = Field(default_factory=list, description="Sequential or DAG execution steps")


class AgentPlanRequest(BaseModel):
    task_prompt: str = Field(min_length=3, description="Task prompt to plan")
    max_budget_usd: Optional[float] = Field(default=None, ge=0, description="Budget cap in USD")
    allowed_tool_ids: Optional[List[str]] = Field(default=None, description="Optional tool IDs to restrict planning to")
    max_steps: Optional[int] = Field(default=None, ge=1, le=20, description="Maximum allowed plan steps")


class AgentPlanResponse(BaseModel):
    task: str
    is_achievable: bool
    impossibility_reason: Optional[str] = None
    plan_explanation: str
    steps: List[PlanStep]
    total_estimated_cost_usd: float
    total_estimated_cost_micro_dollars: int
    step_count: int
    requires_human_approval: bool
    approval_reason: Optional[str] = None
