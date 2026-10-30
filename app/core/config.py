import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "ToolToll"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./tooltoll.db",
        description="Async database connection string. Supports postgresql+asyncpg://... or sqlite+aiosqlite:///..."
    )

    # Security
    AUTH_SECRET_KEY: str = Field(
        default="tooltoll-super-secure-jwt-signing-secret-key-32-chars-min",
        description="JWT HMAC secret key"
    )
    AUTH_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Credential Encryption (Fernet 32-byte url-safe base64 string)
    AGENT_CREDENTIAL_ENCRYPTION_KEY: str = Field(
        default="Dq0qDk8e0b6w0rZ3A1r1mE8lV2gT4yU6iO8pA0sD2fG=",
        description="Fernet key for encrypting upstream API secrets"
    )

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5200",
        "http://127.0.0.1:5200",
        "http://localhost:5190",
        "http://127.0.0.1:5190",
        "http://localhost:5185",
        "http://127.0.0.1:5185",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8090",
        "http://127.0.0.1:8090",
        "http://localhost:8088",
        "http://127.0.0.1:8088",
    ]

    # Platform Business Rules
    PLATFORM_FEE_PERCENT: float = 0.15  # 15% platform fee on paid tool calls
    DEFAULT_CURRENCY: str = "USD"
    MIN_TOPUP_AMOUNT: float = 5.0
    MAX_TOPUP_AMOUNT: float = 1000.0

    # PayPal Sandbox Configuration
    PAYPAL_MODE: str = "sandbox"  # 'sandbox', 'live', or 'mock'
    PAYPAL_CLIENT_ID: Optional[str] = "sb-mock-client-id"
    PAYPAL_CLIENT_SECRET: Optional[str] = "sb-mock-client-secret"
    PAYPAL_BASE_URL: str = "https://api-m.sandbox.paypal.com"
    PAYPAL_WEBHOOK_ID: Optional[str] = "MOCK-WEBHOOK-ID"

    # LLM Configuration
    LLM_PROVIDER: str = "mock"  # 'openai', 'anthropic', 'gemini', or 'mock'
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o-mini"

    # Tool Execution Limits & SSRF
    TOOL_EXECUTION_TIMEOUT: int = 15  # seconds
    MAX_REQUEST_SIZE_BYTES: int = 1_000_000  # 1 MB
    ALLOW_PRIVATE_IPS_FOR_TESTS: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
