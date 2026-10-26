from typing import Optional, Any, Dict
from fastapi import HTTPException, status


class ToolTollBaseException(Exception):
    """Base exception for all ToolToll AI service errors."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class LLMConfigurationError(ToolTollBaseException):
    """Raised when Anthropic Claude credentials or settings are missing."""
    pass


class LLMProviderError(ToolTollBaseException):
    """Raised when Anthropic Claude returns an error or rate limit."""
    pass


class BackendConnectionError(ToolTollBaseException):
    """Raised when the AI service cannot connect to the ToolToll main backend."""
    pass


class ToolNotFoundError(ToolTollBaseException):
    """Raised when a tool is not found in the approved active catalog."""
    pass


class UnauthorizedAgentException(ToolTollBaseException):
    """Raised when caller credentials or agent API key is invalid."""
    pass


class InsufficientFundsError(ToolTollBaseException):
    """Raised when agent wallet has insufficient balance (HTTP 402)."""
    pass


class SpendingLimitExceededError(ToolTollBaseException):
    """Raised when per-call or daily spending limits are exceeded (HTTP 403)."""
    pass


class BudgetExceededError(ToolTollBaseException):
    """Raised when task projected cost exceeds the caller's budget cap."""
    pass


class SSRFSecurityError(ToolTollBaseException):
    """Raised when an endpoint URL resolves to a forbidden private or loopback IP."""
    pass


class PlanValidationError(ToolTollBaseException):
    """Raised when an execution plan is invalid or cyclic."""
    pass


class GatewayExecutionError(ToolTollBaseException):
    """Raised when tool execution through the paid gateway fails."""
    pass
