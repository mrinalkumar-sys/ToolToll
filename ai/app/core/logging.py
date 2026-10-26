import logging
import sys
import json
import time
from typing import Any, Dict
from app.core.config import settings


class JsonFormatter(logging.Formatter):
    """
    Structured JSON formatter for production log ingestion.
    Redacts secrets and provides structured metadata.
    """
    SENSITIVE_KEYS = {"authorization", "x-agent-key", "api_key", "upstream_secret", "password", "token", "secret"}

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Attach custom extra fields
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "agent_id"):
            log_obj["agent_id"] = record.agent_id
        if hasattr(record, "tool_id"):
            log_obj["tool_id"] = record.tool_id
        if hasattr(record, "duration_ms"):
            log_obj["duration_ms"] = record.duration_ms
        if hasattr(record, "extra_data"):
            log_obj["data"] = self._redact(record.extra_data)

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)

    def _redact(self, data: Any) -> Any:
        if isinstance(data, dict):
            return {
                k: ("[REDACTED]" if any(s in k.lower() for s in self.SENSITIVE_KEYS) else self._redact(v))
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [self._redact(item) for item in data]
        return data


def setup_logger(name: str = "tooltoll-ai") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        if settings.APP_ENV == "production":
            handler.setFormatter(JsonFormatter())
        else:
            fmt = logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
            handler.setFormatter(fmt)
        logger.addHandler(handler)

    return logger


logger = setup_logger()
