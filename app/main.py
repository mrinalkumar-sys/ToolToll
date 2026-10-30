from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.services.seed_service import seed_database
from app.api.auth import router as auth_router
from app.api.agents import router as agents_router
from app.api.tools import router as tools_router
from app.api.wallet import router as wallet_router
from app.api.execution import router as execution_router
from app.api.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    await init_db()
    # Seed default roles, initial wallets, and safe demo tools
    async with AsyncSessionLocal() as session:
        await seed_database(session)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="ToolToll — AI-Powered Pay-Per-Use API Marketplace and Monetization Protocol",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(agents_router, prefix=settings.API_V1_PREFIX)
app.include_router(tools_router, prefix=settings.API_V1_PREFIX)
app.include_router(wallet_router, prefix=settings.API_V1_PREFIX)
app.include_router(execution_router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_router, prefix=settings.API_V1_PREFIX)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "version": "1.0.0",
    }
