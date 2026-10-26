from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ToolDiscoveryRequest(BaseModel):
    task_prompt: str = Field(min_length=3, description="Natural language description of the task or desired tool capability")
    category: Optional[str] = Field(default=None, description="Optional category filter e.g. 'nlp', 'security', 'utility'")
    max_price: Optional[float] = Field(default=None, ge=0, description="Maximum price per call in USD")
    min_reliability: Optional[float] = Field(default=0.0, ge=0.0, le=1.0, description="Minimum historical success rate")
    allowed_tool_ids: Optional[List[str]] = Field(default=None, description="Optional agent permission whitelist")
    limit: int = Field(default=10, ge=1, le=50, description="Max number of ranked tools to return")


class DiscoveredToolItem(BaseModel):
    tool_id: str
    name: str
    category: str
    short_desc: str
    price_per_call: float
    price_micro_dollars: int
    currency: str
    relevance_score: float
    reliability_score: float
    input_schema: Dict[str, Any]
    output_schema: Optional[Dict[str, Any]] = None
    match_explanation: str


class ToolDiscoveryResponse(BaseModel):
    task: str
    total_candidates: int
    matches: List[DiscoveredToolItem]
    query_duration_ms: float
