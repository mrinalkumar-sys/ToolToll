from fastapi import APIRouter
from app.api.health import router as health_router
from app.modules.tool_discovery.router import router as tool_discovery_router
from app.modules.agent_planner.router import router as planner_router
from app.modules.quality_judge.router import router as judge_router
from app.modules.price_advisor.router import router as advisor_router
from app.modules.api_onboarding.router import router as onboarding_router
from app.modules.demo_agent.router import router as demo_agent_router

api_router = APIRouter()

# Health endpoints (both root and api prefixed for easy monitoring)
api_router.include_router(health_router)

# Core Feature Modules
api_router.include_router(tool_discovery_router)
api_router.include_router(planner_router)
api_router.include_router(judge_router)
api_router.include_router(advisor_router)
api_router.include_router(onboarding_router)
api_router.include_router(demo_agent_router)
