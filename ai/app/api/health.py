from typing import Any, Dict
from fastapi import APIRouter
from app.clients.backend_client import backend_client
from app.clients.llm_client import llm_client
from app.core.config import settings

router = APIRouter(tags=["Health & Status"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Operational Health Check.
    Reports service status, LLM (Groq) configuration, and backend connectivity.
    """
    backend_status = await backend_client.check_health()

    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0",
        "llm": {
            "provider": getattr(llm_client, "provider", settings.LLM_PROVIDER),
            "configured": llm_client.is_configured,
            "primary_model": settings.GROQ_MODEL,
            "fast_model": settings.GROQ_FAST_MODEL,
        },
        # Retain claude field for backward-compatibility
        "claude": {
            "configured": llm_client.is_configured,
            "primary_model": settings.GROQ_MODEL,
            "fast_model": settings.GROQ_FAST_MODEL,
        },
        "backend": backend_status,
    }
