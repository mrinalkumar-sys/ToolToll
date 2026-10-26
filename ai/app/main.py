import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api.router import api_router
from app.api.health import router as root_health_router
from app.core.config import settings
from app.core.exceptions import (
    BackendConnectionError,
    BudgetExceededError,
    GatewayExecutionError,
    InsufficientFundsError,
    LLMConfigurationError,
    LLMProviderError,
    PlanValidationError,
    SpendingLimitExceededError,
    SSRFSecurityError,
    ToolNotFoundError,
    UnauthorizedAgentException,
)
from app.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} in '{settings.APP_ENV}' mode on port {settings.PORT}...")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    description="ToolToll AI Service — Tool Discovery, Planning, Quality Judging, Pricing Advice, and API Onboarding",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Logging and Tracing Middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    start_time = time.perf_counter()

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start_time) * 1000
    response.headers["X-Request-ID"] = request_id

    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)",
        extra={
            "request_id": request_id,
            "duration_ms": round(duration_ms, 2),
        }
    )
    return response


# Exception Handlers
@app.exception_handler(LLMConfigurationError)
async def llm_config_handler(request: Request, exc: LLMConfigurationError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": "LLM_NOT_CONFIGURED", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(LLMProviderError)
async def llm_provider_handler(request: Request, exc: LLMProviderError):
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"error": "LLM_PROVIDER_ERROR", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(InsufficientFundsError)
async def insufficient_funds_handler(request: Request, exc: InsufficientFundsError):
    return JSONResponse(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        content={"error": "PAYMENT_REQUIRED", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(SpendingLimitExceededError)
async def spending_limit_handler(request: Request, exc: SpendingLimitExceededError):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "SPENDING_LIMIT_EXCEEDED", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(ToolNotFoundError)
async def tool_not_found_handler(request: Request, exc: ToolNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "TOOL_NOT_FOUND", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(UnauthorizedAgentException)
async def unauthorized_agent_handler(request: Request, exc: UnauthorizedAgentException):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"error": "UNAUTHORIZED_AGENT", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(SSRFSecurityError)
async def ssrf_security_handler(request: Request, exc: SSRFSecurityError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "SSRF_SECURITY_VIOLATION", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(PlanValidationError)
async def plan_validation_handler(request: Request, exc: PlanValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "PLAN_VALIDATION_ERROR", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(BudgetExceededError)
async def budget_exceeded_handler(request: Request, exc: BudgetExceededError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "BUDGET_EXCEEDED", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(BackendConnectionError)
async def backend_connection_handler(request: Request, exc: BackendConnectionError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": "BACKEND_UNAVAILABLE", "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(GatewayExecutionError)
async def gateway_execution_handler(request: Request, exc: GatewayExecutionError):
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"error": "GATEWAY_EXECUTION_ERROR", "detail": exc.message, "details": exc.details},
    )


# Register Routers
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")

# Direct /health for container orchestrators and curl
app.include_router(root_health_router)
# Versioned API routes e.g. /api/v1/tools/discover, /api/v1/agent/plan, /api/v1/health
app.include_router(api_router, prefix=settings.API_PREFIX)
