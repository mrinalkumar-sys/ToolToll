from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, HttpUrl
from app.models.tool import ToolStatus, AuthType


class ToolCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    short_desc: str = Field(min_length=10, max_length=255)
    detailed_desc: Optional[str] = None
    category: str = Field(min_length=2, max_length=64)
    tags: List[str] = Field(default_factory=list)

    base_url: str = Field(description="Upstream base URL e.g. https://api.example.com")
    endpoint_path: str = Field(default="/", description="Endpoint route path e.g. /v1/translate")
    http_method: str = Field(default="POST", pattern="^(GET|POST|PUT|DELETE|PATCH)$")

    input_schema: Dict[str, Any] = Field(description="JSON Schema for accepted parameters")
    output_schema: Optional[Dict[str, Any]] = None

    auth_type: AuthType = AuthType.NONE
    upstream_secret: Optional[str] = Field(default=None, description="Secret token or key to inject upstream")
    header_name: Optional[str] = Field(default=None, description="Header name for API key auth e.g. X-API-Key")

    price_per_call: Decimal = Field(default=Decimal("0.0100"), ge=0, description="Authoritative price per successful call")
    currency: str = Field(default="USD", max_length=3)
    timeout_seconds: int = Field(default=15, ge=1, le=60)
    rate_limit_per_minute: int = Field(default=60, ge=1, le=1000)
    terms_of_use: Optional[str] = None
    creator_contact: Optional[str] = None


class ToolUpdate(BaseModel):
    name: Optional[str] = None
    short_desc: Optional[str] = None
    detailed_desc: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    base_url: Optional[str] = None
    endpoint_path: Optional[str] = None
    http_method: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    auth_type: Optional[AuthType] = None
    upstream_secret: Optional[str] = None
    header_name: Optional[str] = None
    price_per_call: Optional[Decimal] = None
    timeout_seconds: Optional[int] = None
    rate_limit_per_minute: Optional[int] = None
    terms_of_use: Optional[str] = None
    creator_contact: Optional[str] = None


class ToolResponse(BaseModel):
    id: str
    creator_id: str
    name: str
    slug: str
    short_desc: str
    detailed_desc: Optional[str]
    category: str
    tags: List[str]
    base_url: str
    endpoint_path: str
    http_method: str
    input_schema: Dict[str, Any]
    output_schema: Optional[Dict[str, Any]]
    auth_type: AuthType
    header_name: Optional[str]
    price_per_call: Decimal
    currency: str
    timeout_seconds: int
    rate_limit_per_minute: int
    terms_of_use: Optional[str]
    creator_contact: Optional[str]
    status: ToolStatus
    rejection_reason: Optional[str]
    is_internal_mock: bool
    total_calls: int
    success_calls: int
    average_latency_ms: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ToolTestRequest(BaseModel):
    sample_input: Dict[str, Any]


class ToolTestResponse(BaseModel):
    is_successful: bool
    response_status: Optional[int]
    response_body: Optional[Any]
    latency_ms: float
    error_message: Optional[str] = None
