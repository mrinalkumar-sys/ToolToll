from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """
    ToolToll AI Service Configuration.
    Loaded from environment variables or .env file.
    """
    APP_NAME: str = "ToolToll AI Service"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8001
    API_PREFIX: str = "/api/v1"

    # Inter-Service Security
    INTERNAL_SERVICE_KEY: str = Field(
        default="tooltoll-internal-secret-service-key-2026",
        description="Shared secret for authenticating internal requests between main backend and AI service"
    )

    # LLM Provider Configuration ('groq' or 'anthropic')
    LLM_PROVIDER: str = Field(
        default="groq",
        description="Active LLM provider: 'groq' or 'anthropic'"
    )

    # Groq API Configuration
    GROQ_API_KEY: Optional[str] = Field(
        default=None,
        description="Groq API Key (gsk_...)"
    )
    GROQ_MODEL: str = Field(
        default="openai/gpt-oss-120b",
        description="Primary high-performance model on Groq for planning, synthesis, and onboarding"
    )
    GROQ_FAST_MODEL: str = Field(
        default="openai/gpt-oss-20b",
        description="Ultra-fast model on Groq for Stage-2 Quality Judge and Price Advisor"
    )
    GROQ_TIMEOUT_SECONDS: float = Field(
        default=30.0,
        description="Timeout for Groq API calls in seconds"
    )
    GROQ_MAX_RETRIES: int = Field(
        default=3,
        description="Maximum retry attempts for transient Groq errors"
    )

    # Anthropic Claude Configuration (Optional alternative)
    ANTHROPIC_API_KEY: Optional[str] = Field(
        default=None,
        description="Anthropic Claude API Key"
    )
    ANTHROPIC_MODEL: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Anthropic primary model"
    )
    ANTHROPIC_FAST_MODEL: str = Field(
        default="claude-3-haiku-20240307",
        description="Anthropic fast model"
    )
    ANTHROPIC_TIMEOUT_SECONDS: float = Field(
        default=30.0,
        description="Timeout for Anthropic API requests"
    )
    ANTHROPIC_MAX_RETRIES: int = Field(
        default=3,
        description="Maximum retry attempts for transient Claude API errors"
    )

    # ToolToll Main Backend Gateway & Marketplace Configuration
    BACKEND_BASE_URL: str = Field(
        default="http://localhost:8000",
        description="Base URL of the main ToolToll backend service"
    )
    BACKEND_TIMEOUT_SECONDS: float = Field(
        default=20.0,
        description="Timeout for calls to the main backend"
    )
    GATEWAY_MAX_RETRIES: int = Field(
        default=2,
        description="Maximum retries for idempotent read calls"
    )

    # Business Rules & Money Representation
    MICRO_DOLLARS_PER_USD: int = 1_000_000
    DEFAULT_MAX_PLAN_STEPS: int = 10
    DEFAULT_MAX_BUDGET_USD: float = 5.0
    DEFAULT_DAILY_LIMIT_USD: float = 25.0
    DEFAULT_PER_CALL_LIMIT_USD: float = 1.0

    # Security & SSRF Prevention
    ALLOW_PRIVATE_IPS_FOR_TESTS: bool = False
    BLOCKED_IP_NETWORKS: List[str] = [
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "0.0.0.0/8",
        "::1/128",
        "fc00::/7",
        "fe80::/10"
    ]

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
