from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OnboardingDraftRequest(BaseModel):
    raw_documentation: str = Field(min_length=10, description="Pasted API documentation, Markdown docs, or OpenAPI JSON/YAML")


class StructuredToolDraft(BaseModel):
    name: str = Field(description="Display name of the tool")
    short_desc: str = Field(description="Concise one-line summary")
    detailed_desc: Optional[str] = Field(default=None, description="Full capability explanation")
    category: str = Field(description="Category e.g. 'nlp', 'search', 'security', 'utility'")
    tags: List[str] = Field(default_factory=list, description="Keywords for search indexing")

    base_url: str = Field(description="Base URL e.g. 'https://api.example.com'")
    endpoint_path: str = Field(default="/", description="Endpoint route path e.g. '/v1/check'")
    http_method: str = Field(default="POST", description="HTTP Method e.g. POST, GET")

    input_schema: Dict[str, Any] = Field(default_factory=dict, description="JSON Schema for accepted parameters")
    output_schema: Optional[Dict[str, Any]] = Field(default=None, description="JSON Schema for response body")

    auth_type: str = Field(default="none", description="'none', 'api_key', or 'bearer'")
    header_name: Optional[str] = Field(default=None, description="Header name for auth if applicable")
    suggested_price_usd: float = Field(default=0.0100, ge=0.0, description="Estimated per-call price in USD")


class OnboardingDraftResponse(BaseModel):
    draft: StructuredToolDraft
    price_micro_dollars: int
    security_check_passed: bool
    security_warnings: List[str] = []
    ready_for_review: bool
    notice: str = "This is an unapproved draft. Review and submit through the creator dashboard to publish."
