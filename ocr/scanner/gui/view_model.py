"""Presentation mapping for the read-only Pi scanner screen."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from gui.state_reader import ReadResult
from runtime.device_state import ACTIVITY_TEXT

_PROGRESS = {
    "idle": 0,
    "request_received": 12,
    "ready_to_capture": 28,
    "capturing": 42,
    "processing": 72,
    "submitting": 92,
    "completed": 100,
    "failed": 100,
}

_TONE_BY_ACTIVITY = {
    "idle": "ready",
    "ready_to_capture": "attention",
    "capturing": "attention",
    "completed": "success",
    "failed": "danger",
}


@dataclass(frozen=True)
class GuiViewModel:
    internet_badge: str
    internet_status: str
    internet_tone: str
    backend_status: str
    backend_tone: str
    worker_status: str
    worker_tone: str
    activity_text: str
    activity_tone: str
    progress_percent: int
    request_owner_name: str
    request_status: str
    document_label: str
    camera_label: str
    updated_label: str
    system_note: str
    camera_preview_active: bool


def _title(value: object) -> str:
    return str(value or "").replace("_", " ").strip().title()


def _updated_label(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return "Not available"
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        return datetime.fromisoformat(normalized).astimezone().strftime("%I:%M:%S %p")
    except ValueError:
        return "Not available"


def _unavailable_model(note: str) -> GuiViewModel:
    return GuiViewModel(
        internet_badge="STATUS UNAVAILABLE",
        internet_status="Checking",
        internet_tone="muted",
        backend_status="Checking",
        backend_tone="muted",
        worker_status="Offline",
        worker_tone="danger",
        activity_text="Waiting for status",
        activity_tone="muted",
        progress_percent=0,
        request_owner_name="No active request",
        request_status="Waiting",
        document_label="No active document",
        camera_label="Unavailable",
        updated_label="Not available",
        system_note=note,
        camera_preview_active=False,
    )


def build_view_model(result: ReadResult) -> GuiViewModel:
    if result.status == "missing":
        return _unavailable_model("Starting device monitor")
    if result.status in {"invalid", "stale"} or not result.snapshot:
        return _unavailable_model("Device status needs attention")

    payload = result.snapshot
    internet = str(payload["internet_status"])
    backend = str(payload["backend_status"])
    worker = str(payload["worker_status"])
    activity = str(payload["activity"])
    activity_state = payload.get("activity_state")
    activity_label = (
        str(activity_state.get("text") or "").strip()
        if isinstance(activity_state, dict)
        else ""
    ) or ACTIVITY_TEXT[activity]
    return GuiViewModel(
        internet_badge="ONLINE" if internet == "online" else "OFFLINE",
        internet_status=_title(internet),
        internet_tone="success" if internet == "online" else "danger",
        backend_status={
            "connected": "Connected",
            "unavailable": "Unavailable",
            "no_internet": "No Internet",
        }[backend],
        backend_tone="success" if backend == "connected" else "danger",
        worker_status=_title(worker),
        worker_tone={
            "ready": "success",
            "busy": "active",
            "error": "danger",
            "offline": "danger",
        }[worker],
        activity_text=activity_label,
        activity_tone=_TONE_BY_ACTIVITY.get(activity, "active"),
        progress_percent=_PROGRESS[activity],
        request_owner_name=str(
            payload.get("request_owner_name")
            or payload.get("request_reference")
            or "No active request"
        ),
        request_status=_title(activity),
        document_label=str(payload.get("document_label") or "No active document"),
        camera_label=_title(payload.get("camera_status") or "unavailable"),
        updated_label=_updated_label(payload.get("reported_at")),
        system_note=(
            _title(payload.get("safe_error_code"))
            if payload.get("safe_error_code")
            else "All status signals are independent"
        ),
        camera_preview_active=str(payload.get("camera_status") or "") == "preview_active",
    )


__all__ = ["GuiViewModel", "build_view_model"]
