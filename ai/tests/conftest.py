import os
import pytest
from httpx import AsyncClient, ASGITransport

# Set test environment flags
os.environ["APP_ENV"] = "testing"
os.environ["ALLOW_PRIVATE_IPS_FOR_TESTS"] = "false"
os.environ["INTERNAL_SERVICE_KEY"] = "test-internal-key-12345"

from app.main import app
from app.core.config import settings


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
