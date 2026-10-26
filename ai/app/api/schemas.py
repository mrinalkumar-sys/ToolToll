from typing import Any, Dict, Optional
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str
    detail: str
    status_code: int
    context: Optional[Dict[str, Any]] = None
