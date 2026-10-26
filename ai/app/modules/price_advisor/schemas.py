from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PriceAdviceRequest(BaseModel):
    name: str = Field(min_length=2, description="Name of the API tool")
    category: str = Field(min_length=2, description="Tool category e.g. 'nlp', 'security', 'utility'")
    description: str = Field(min_length=5, description="Description of the API functionality")
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None


class ClaudePriceOutput(BaseModel):
    suggested_price_usd: float = Field(ge=0.0001, description="Recommended price per call in USD")
    min_viable_price_usd: float = Field(ge=0.0001, description="Floor price in USD")
    max_viable_price_usd: float = Field(ge=0.0001, description="Ceiling price in USD")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score")
    rationale: str = Field(description="Economic and technical justification")


class PriceAdviceResponse(BaseModel):
    tool_name: str
    category: str
    suggested_price_usd: float
    suggested_price_micro_dollars: int
    min_viable_price_usd: float
    max_viable_price_usd: float
    confidence: float
    rationale: str
    comparable_tools_count: int
    market_average_usd: float
