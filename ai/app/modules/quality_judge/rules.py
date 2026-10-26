from typing import Any, Dict, Optional, Tuple
import jsonschema


def run_stage1_deterministic_checks(
    http_status: Optional[int],
    response_body: Any,
    output_schema: Optional[Dict[str, Any]] = None,
    duration_ms: float = 0.0,
    timeout_threshold_ms: float = 15000.0,
) -> Tuple[bool, Optional[str]]:
    """
    Stage-1 deterministic rule evaluation.
    Free, instant rule checks:
    - HTTP status codes (5xx, 4xx errors)
    - Empty or null response bodies
    - Excessive latency / timeouts
    - Conformance to declared output JSON schema

    Returns (passed: bool, failure_reason: Optional[str])
    """
    # 1. HTTP Status check
    if http_status is not None:
        if 500 <= http_status <= 599:
            return False, f"Tool server error: HTTP {http_status}"
        if 400 <= http_status <= 499:
            return False, f"Tool client error: HTTP {http_status}"

    # 2. Timeout check
    if duration_ms > timeout_threshold_ms:
        return False, f"Execution latency ({duration_ms:.1f}ms) exceeded timeout limit ({timeout_threshold_ms:.0f}ms)"

    # 3. Empty or null body check
    if response_body is None:
        return False, "Tool returned empty (None) response"

    if isinstance(response_body, str) and not response_body.strip():
        return False, "Tool returned an empty string response"

    if isinstance(response_body, (dict, list)) and len(response_body) == 0:
        return False, "Tool returned an empty collection/object"

    # 4. JSON Schema compliance check
    if output_schema and isinstance(output_schema, dict) and "properties" in output_schema:
        try:
            jsonschema.validate(instance=response_body, schema=output_schema)
        except jsonschema.ValidationError as e:
            return False, f"Output violated declared JSON schema: {e.message}"

    return True, None
