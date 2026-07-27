"""Presentation mapping for the read-only OCR terminal GUI."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from gui.state_reader import ReadResult

_STATE_TITLES = {
    "starting": "Starting scanner",
    "idle": "Scanner ready",
    "claiming_request": "Checking for requests",
    "no_pending_request": "Scanner ready",
    "request_claimed": "Request received",
    "starting_preview": "Opening camera preview",
    "waiting_for_capture": "Ready to capture",
    "capturing": "Capturing document",
    "preprocessing": "Preparing image",
    "running_ocr": "Reading document",
    "extracting_fields": "Extracting required fields",
    "submitting_result": "Submitting result",
    "completed": "Processing completed",
    "failed": "Processing failed",
    "stopping": "Stopping scanner",
}

_STATE_PROGRESS = {
    "starting": 4,
    "idle": 0,
    "claiming_request": 4,
    "no_pending_request": 0,
    "request_claimed": 12,
    "starting_preview": 22,
    "waiting_for_capture": 32,
    "capturing": 44,
    "preprocessing": 56,
    "running_ocr": 70,
    "extracting_fields": 82,
    "submitting_result": 94,
    "completed": 100,
    "failed": 100,
    "stopping": 0,
}

_STATE_TONES = {
    "completed": "success",
    "failed": "danger",
    "waiting_for_capture": "attention",
    "capturing": "attention",
    "starting_preview": "attention",
    "idle": "ready",
    "no_pending_request": "ready",
}

_CAMERA_LABELS = {
    "unknown": "Unknown",
    "checking": "Checking",
    "ready": "Ready",
    "starting": "Starting",
    "preview_active": "Preview active",
    "capture_in_progress": "Capturing",
    "captured": "Captured",
    "error": "Error",
    "unavailable": "Unavailable",
    "stopped": "Stopped",
}


@dataclass(frozen=True)
class GuiViewModel:
    connection_status: str
    title: str
    message: str
    tone: str
    progress_percent: int
    document_label: str
    application_reference: str
    request_reference: str
    camera_label: str
    error_label: str
    updated_label: str
    show_request_panel: bool


def build_view_model(result: ReadResult) -> GuiViewModel:
    if result.status == "missing":
        return _offline_model(
            title="Waiting for worker",
            message="The OCR worker has not published its status yet.",
            connection_status="Worker offline",
            error_label="State file unavailable",
        )

    if result.status == "invalid" or result.snapshot is None:
        return _offline_model(
            title="Worker status unavailable",
            message="The scanner status could not be read safely.",
            connection_status="Status unavailable",
            error_label=_safe_code_label(result.error_code),
        )

    snapshot = result.snapshot
    worker_state = str(snapshot.get("worker_state") or "idle")
    stale = result.status == "stale"

    if stale:
        return GuiViewModel(
            connection_status="Worker connection stale",
            title="Worker connection unavailable",
            message="The worker stopped updating its status. OCR remains independent.",
            tone="danger",
            progress_percent=0,
            document_label=str(snapshot.get("document_label") or "Document"),
            application_reference=str(
                snapshot.get("application_reference") or "Not available"
            ),
            request_reference=str(
                snapshot.get("request_reference") or "Not available"
            ),
            camera_label=_camera_label(snapshot.get("camera_status")),
            error_label="State heartbeat expired",
            updated_label=_updated_label(snapshot.get("updated_at")),
            show_request_panel=bool(
                snapshot.get("request_reference")
                or snapshot.get("application_reference")
            ),
        )

    error_code = snapshot.get("safe_error_code")
    return GuiViewModel(
        connection_status="Worker online",
        title=_STATE_TITLES.get(worker_state, "Scanner status"),
        message=str(snapshot.get("safe_message") or "Scanner status updated."),
        tone=_STATE_TONES.get(worker_state, "active"),
        progress_percent=_STATE_PROGRESS.get(worker_state, 0),
        document_label=str(snapshot.get("document_label") or "Document"),
        application_reference=str(
            snapshot.get("application_reference") or "Not available"
        ),
        request_reference=str(snapshot.get("request_reference") or "Not available"),
        camera_label=_camera_label(snapshot.get("camera_status")),
        error_label=_safe_code_label(error_code),
        updated_label=_updated_label(snapshot.get("updated_at")),
        show_request_panel=bool(
            snapshot.get("request_reference")
            or snapshot.get("application_reference")
        ),
    )


def _offline_model(
    *,
    title: str,
    message: str,
    connection_status: str,
    error_label: str,
) -> GuiViewModel:
    return GuiViewModel(
        connection_status=connection_status,
        title=title,
        message=message,
        tone="danger",
        progress_percent=0,
        document_label="No active document",
        application_reference="Not available",
        request_reference="Not available",
        camera_label="Unavailable",
        error_label=error_label,
        updated_label="Not available",
        show_request_panel=False,
    )


def _camera_label(value: object) -> str:
    return _CAMERA_LABELS.get(str(value or "unknown"), "Unknown")


def _safe_code_label(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return "None"
    return text.replace("_", " ").replace("-", " ").title()[:96]


def _updated_label(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return "Not available"
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return "Not available"
    return parsed.astimezone().strftime("%I:%M:%S %p")


__all__ = ["GuiViewModel", "build_view_model"]
