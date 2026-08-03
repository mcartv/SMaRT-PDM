"""Privacy-safe runtime state contract for the Raspberry Pi OCR worker."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional

SCHEMA_VERSION = 1

WORKER_STATES = frozenset(
    {
        "starting",
        "idle",
        "claiming_request",
        "no_pending_request",
        "request_claimed",
        "starting_preview",
        "waiting_for_capture",
        "capturing",
        "preprocessing",
        "running_ocr",
        "extracting_fields",
        "submitting_result",
        "completed",
        "failed",
        "stopping",
    }
)

CAMERA_STATUSES = frozenset(
    {
        "unknown",
        "checking",
        "ready",
        "starting",
        "preview_active",
        "capture_in_progress",
        "captured",
        "error",
        "unavailable",
        "stopped",
    }
)

DEFAULT_MESSAGES = {
    "starting": "Starting the OCR worker.",
    "idle": "Waiting for an OCR request.",
    "claiming_request": "Checking for a pending OCR request.",
    "no_pending_request": "No pending OCR request is available.",
    "request_claimed": "An OCR request was received.",
    "starting_preview": "Starting the camera preview.",
    "waiting_for_capture": (
        "Align the document and press the physical capture button."
    ),
    "capturing": "Capturing the document.",
    "preprocessing": "Preparing the captured image.",
    "running_ocr": "Running optical character recognition.",
    "extracting_fields": "Extracting structured document fields.",
    "submitting_result": "Submitting the OCR result.",
    "completed": "The OCR result was submitted.",
    "failed": "Document processing failed.",
    "stopping": "Stopping the OCR worker.",
}

DOCUMENT_LABELS = {
    "birth_certificate": "Birth Certificate / PSA",
    "certificate_of_birth": "Birth Certificate / PSA",
    "certificate_of_live_birth": "Birth Certificate / PSA",
    "psa_birth_certificate": "Birth Certificate / PSA",
    "certificate_of_indigency": "Certificate of Indigency",
    "indigency": "Certificate of Indigency",
    "student_grade_forms": "Grade Report",
    "grade_report": "Grade Report",
    "grade_form": "Grade Report",
    "certificate_of_registration": "Certificate of Registration",
    "letter_of_request": "Letter of Request",
    "application_form": "Application Form",
}

_SAFE_CODE_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{1,80}$")
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]+")


def utc_timestamp() -> str:
    """Return a stable UTC timestamp suitable for the state JSON contract."""

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _clean_display_text(value: object, *, maximum_length: int) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    text = _CONTROL_CHARACTERS.sub(" ", text)
    text = " ".join(text.split())
    return text[:maximum_length]


def mask_reference(value: object) -> Optional[str]:
    """Mask a request/application reference without exposing the full value."""

    text = _clean_display_text(value, maximum_length=128)
    if not text:
        return None

    if text.upper().startswith("PDM-"):
        parts = text.split("-")
        if len(parts) >= 3:
            prefix = "-".join(parts[:2])
            suffix = parts[-1][-2:] if len(parts[-1]) >= 2 else ""
            return f"{prefix}-••••{suffix}"

    if len(text) <= 6:
        return "••••"
    if len(text) <= 12:
        return f"{text[:3]}…{text[-2:]}"
    return f"{text[:8]}…{text[-4:]}"


def safe_document_key(value: object) -> Optional[str]:
    text = _clean_display_text(value, maximum_length=80)
    if not text:
        return None
    normalized = re.sub(r"[^a-z0-9_\-]", "_", text.lower())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized or None


def safe_document_label(document_key: object) -> str:
    key = safe_document_key(document_key)
    return DOCUMENT_LABELS.get(key or "", "Document")


def safe_error_code(value: object) -> Optional[str]:
    text = _clean_display_text(value, maximum_length=80)
    if not text:
        return None
    normalized = text.replace(" ", "_")
    if not _SAFE_CODE_PATTERN.fullmatch(normalized):
        return "worker_state_error"
    return normalized.lower()


@dataclass(frozen=True)
class WorkerStateSnapshot:
    """One versioned, privacy-safe worker-state snapshot."""

    schema_version: int
    sequence: int
    worker_state: str
    request_reference: Optional[str]
    application_reference: Optional[str]
    document_key: Optional[str]
    document_label: str
    camera_status: str
    safe_message: str
    failure_stage: Optional[str]
    safe_error_code: Optional[str]
    updated_at: str

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError("unsupported worker-state schema version")
        if self.sequence < 1:
            raise ValueError("worker-state sequence must be positive")
        if self.worker_state not in WORKER_STATES:
            raise ValueError("invalid worker state")
        if self.camera_status not in CAMERA_STATUSES:
            raise ValueError("invalid camera status")
        if not self.safe_message or len(self.safe_message) > 240:
            raise ValueError("invalid safe worker-state message")
        if self.failure_stage and self.failure_stage not in WORKER_STATES:
            raise ValueError("invalid worker-state failure stage")
        if self.safe_error_code and not _SAFE_CODE_PATTERN.fullmatch(
            self.safe_error_code
        ):
            raise ValueError("invalid safe worker-state error code")

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_worker_state(
    *,
    sequence: int,
    worker_state: str,
    request_reference: object = None,
    application_reference: object = None,
    document_key: object = None,
    camera_status: str = "unknown",
    safe_message: object = None,
    failure_stage: Optional[str] = None,
    safe_error_code_value: object = None,
    updated_at: Optional[str] = None,
) -> WorkerStateSnapshot:
    """Construct a validated snapshot from controlled operational values."""

    resolved_message = _clean_display_text(
        safe_message or DEFAULT_MESSAGES[worker_state],
        maximum_length=240,
    )
    if not resolved_message:
        resolved_message = DEFAULT_MESSAGES[worker_state]

    resolved_key = safe_document_key(document_key)

    return WorkerStateSnapshot(
        schema_version=SCHEMA_VERSION,
        sequence=int(sequence),
        worker_state=worker_state,
        request_reference=mask_reference(request_reference),
        application_reference=mask_reference(application_reference),
        document_key=resolved_key,
        document_label=safe_document_label(resolved_key),
        camera_status=camera_status,
        safe_message=resolved_message,
        failure_stage=failure_stage,
        safe_error_code=safe_error_code(safe_error_code_value),
        updated_at=updated_at or utc_timestamp(),
    )


__all__ = [
    "CAMERA_STATUSES",
    "DEFAULT_MESSAGES",
    "DOCUMENT_LABELS",
    "SCHEMA_VERSION",
    "WORKER_STATES",
    "WorkerStateSnapshot",
    "build_worker_state",
    "mask_reference",
    "safe_document_key",
    "safe_document_label",
    "safe_error_code",
    "utc_timestamp",
]
