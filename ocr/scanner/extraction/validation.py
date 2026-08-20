from __future__ import annotations

import math
import re
from typing import Any, Dict, Iterable


ALLOWED_OVERALL_STATUSES = {
    "pending",
    "normalized",
    "anchored",
    "regions_extracted",
    "ocr_complete",
    "validated",
    "ready_for_contract",
    "review_required",
    "failed",
}

ALLOWED_STAGE_STATUSES = {
    "not_started",
    "success",
    "partial",
    "review_required",
    "failed",
}

LEGAL_STATE_TRANSITIONS = {
    "pending": {"normalized", "failed", "review_required"},
    "normalized": {"anchored", "failed", "review_required"},
    "anchored": {"regions_extracted", "failed", "review_required"},
    "regions_extracted": {"ocr_complete", "failed", "review_required"},
    "ocr_complete": {"validated", "failed", "review_required"},
    "validated": {"ready_for_contract", "failed", "review_required"},
    "ready_for_contract": set(),
    "review_required": set(),
    "failed": set(),
}

STABLE_CODE_PATTERN = re.compile(r"^[A-Z0-9_]+$")


def validate_metric_values(metrics: Dict[str, Any]) -> None:
    for key, value in metrics.items():
        if isinstance(value, bool):
            continue
        if not isinstance(value, (int, float)):
            raise ValueError(f"Metric {key} must be numeric or boolean")
        if not math.isfinite(value):
            raise ValueError(f"Metric {key} must be finite")


def validate_stable_code(code: str) -> None:
    if not STABLE_CODE_PATTERN.fullmatch(code or ""):
        raise ValueError(f"Invalid stable code: {code}")


def validate_issue_codes(issues: Iterable[Dict[str, Any]]) -> None:
    for issue in issues:
        validate_stable_code(str(issue.get("code", "")))


def validate_stage_transition(previous: str, next_status: str) -> None:
    if previous not in LEGAL_STATE_TRANSITIONS:
        raise ValueError(f"Unknown previous status: {previous}")
    if next_status not in ALLOWED_OVERALL_STATUSES:
        raise ValueError(f"Unknown next status: {next_status}")
    allowed = LEGAL_STATE_TRANSITIONS[previous]
    if next_status not in allowed and next_status != previous:
        raise ValueError(f"Illegal transition: {previous} -> {next_status}")
