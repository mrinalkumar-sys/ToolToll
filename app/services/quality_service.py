import json
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple
import jsonschema
from app.models.audit import QualityStatus, QualityReview


class QualityService:
    @staticmethod
    def evaluate_response(
        output_data: Any,
        output_schema: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None,
        duration_ms: float = 0.0,
        timeout_seconds: int = 15,
        max_size_bytes: int = 1_000_000,
    ) -> Tuple[QualityStatus, bool, str, Dict[str, Any]]:
        """
        Deterministic Quality & Integrity Checks.
        Returns:
            (quality_status, is_eligible_for_reversal, reason, details)
        """
        details: Dict[str, Any] = {
            "status_code": status_code,
            "duration_ms": duration_ms,
            "schema_validated": False,
        }

        # 1. Timeout Check
        if duration_ms > (timeout_seconds * 1000 + 500):
            return (
                QualityStatus.FAIL,
                True,
                f"Execution exceeded configured timeout of {timeout_seconds}s (took {duration_ms:.0f}ms)",
                details,
            )

        # 2. HTTP Error Checks
        if status_code is not None:
            if status_code >= 500:
                return (
                    QualityStatus.FAIL,
                    True,
                    f"Upstream server error (HTTP {status_code})",
                    details,
                )
            if status_code >= 400:
                return (
                    QualityStatus.FAIL,
                    False,  # 4xx client errors in caller input are not reversed automatically unless configured
                    f"Upstream client error (HTTP {status_code})",
                    details,
                )

        # 3. Empty or null response
        if output_data is None or output_data == "" or output_data == {}:
            return (
                QualityStatus.FAIL,
                True,
                "Received empty response from tool endpoint",
                details,
            )

        # 4. Response Size Limit
        serialized = json.dumps(output_data) if isinstance(output_data, (dict, list)) else str(output_data)
        if len(serialized.encode("utf-8")) > max_size_bytes:
            return (
                QualityStatus.FAIL,
                True,
                f"Response size exceeded limit of {max_size_bytes} bytes",
                details,
            )

        # 5. Output JSON Schema Validation
        if output_schema:
            try:
                jsonschema.validate(instance=output_data, schema=output_schema)
                details["schema_validated"] = True
            except jsonschema.ValidationError as e:
                details["schema_error"] = str(e.message)
                return (
                    QualityStatus.FAIL,
                    True,
                    f"Output schema mismatch: {e.message}",
                    details,
                )
            except Exception as e:
                details["schema_error"] = str(e)
                return (
                    QualityStatus.UNCERTAIN,
                    False,
                    f"Schema validation could not be completed: {e}",
                    details,
                )

        # Passed all deterministic checks
        return (QualityStatus.PASS, False, "Passed all quality and integrity checks", details)
