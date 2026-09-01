"""Canonical, transport-safe operational state for the Pi OCR station."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Mapping, Optional

DEVICE_STATE_SCHEMA_VERSION = 1

INTERNET_STATUSES = frozenset({"online", "offline"})
BACKEND_STATUSES = frozenset({"connected", "unavailable", "no_internet"})
WORKER_STATUSES = frozenset({"ready", "busy", "error", "offline"})
ACTIVITY_STATUSES = frozenset(
    {
        "idle",
        "request_received",
        "ready_to_capture",
        "capturing",
        "processing",
        "submitting",
        "completed",
        "failed",
    }
)

ACTIVITY_TEXT = {
    "idle": "Waiting for request",
    "request_received": "Request received",
    "ready_to_capture": "Ready to capture",
    "capturing": "Capturing document",
    "processing": "Processing document",
    "submitting": "Sending result",
    "completed": "Completed",
    "failed": "Processing failed",
}

_BUSY_WORKER_STATES = frozenset(
    {
        "request_claimed",
        "starting_preview",
        "waiting_for_capture",
        "capturing",
        "preprocessing",
        "running_ocr",
        "extracting_fields",
        "submitting_result",
    }
)
_ERROR_WORKER_STATES = frozenset({"failed", "request_stopped"})

_ACTIVITY_BY_WORKER_STATE = {
    "starting": "idle",
    "idle": "idle",
    "claiming_request": "idle",
    "no_pending_request": "idle",
    "backend_offline": "idle",
    "stopping": "idle",
    "request_claimed": "request_received",
    "starting_preview": "ready_to_capture",
    "waiting_for_capture": "ready_to_capture",
    "capturing": "capturing",
    "preprocessing": "processing",
    "running_ocr": "processing",
    "extracting_fields": "processing",
    "submitting_result": "submitting",
    "completed": "completed",
    "failed": "failed",
    "request_stopped": "failed",
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def internet_status_from_probes(*results: bool) -> str:
    """Internet is online when at least one independent HTTPS probe works."""

    return "online" if any(bool(result) for result in results) else "offline"


def backend_status_from_probe(internet_status: str, probe_succeeded: bool) -> str:
    if internet_status not in INTERNET_STATUSES:
        raise ValueError("invalid Internet status")
    if internet_status == "offline":
        return "no_internet"
    return "connected" if probe_succeeded else "unavailable"


def worker_status_from_state(worker_state: str, *, heartbeat_fresh: bool) -> str:
    if not heartbeat_fresh:
        return "offline"
    if worker_state in _ERROR_WORKER_STATES:
        return "error"
    if worker_state in _BUSY_WORKER_STATES:
        return "busy"
    return "ready"


def activity_status_from_worker_state(worker_state: str) -> str:
    return _ACTIVITY_BY_WORKER_STATE.get(str(worker_state or ""), "idle")


def activity_text(activity: str, document_label: object = None) -> str:
    if activity not in ACTIVITY_STATUSES:
        raise ValueError("invalid scanner activity")
    label = " ".join(str(document_label or "").split()).strip()
    if label and label not in {"Document", "No active document"}:
        if activity == "processing":
            return f"Processing {label}"
        if activity == "capturing":
            return f"Capturing {label}"
    return ACTIVITY_TEXT[activity]


@dataclass(frozen=True)
class PiDeviceState:
    device_id: str
    internet_status: str
    backend_status: str
    worker_status: str
    activity: str
    worker_state: str
    camera_status: str
    document_key: Optional[str]
    document_label: str
    request_owner_name: Optional[str]
    heartbeat_at: Optional[str]
    internet_checked_at: str
    backend_checked_at: str
    state_changed_at: str
    reported_at: str
    safe_error_code: Optional[str] = None
    schema_version: int = DEVICE_STATE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.schema_version != DEVICE_STATE_SCHEMA_VERSION:
            raise ValueError("unsupported device-state schema version")
        if not str(self.device_id or "").strip():
            raise ValueError("device_id is required")
        if self.internet_status not in INTERNET_STATUSES:
            raise ValueError("invalid Internet status")
        if self.backend_status not in BACKEND_STATUSES:
            raise ValueError("invalid backend status")
        if self.worker_status not in WORKER_STATUSES:
            raise ValueError("invalid worker status")
        if self.activity not in ACTIVITY_STATUSES:
            raise ValueError("invalid scanner activity")

    @property
    def activity_text(self) -> str:
        return activity_text(self.activity, self.document_label)

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["internet"] = {
            "status": self.internet_status,
            "checked_at": self.internet_checked_at,
        }
        payload["backend"] = {
            "status": self.backend_status,
            "checked_at": self.backend_checked_at,
        }
        payload["worker"] = {
            "status": self.worker_status,
            "heartbeat_at": self.heartbeat_at,
        }
        payload["activity_state"] = {
            "status": self.activity,
            "text": self.activity_text,
            "changed_at": self.state_changed_at,
        }
        return payload


def build_device_state(
    *,
    device_id: str,
    internet_status: str,
    backend_status: str,
    worker_snapshot: Optional[Mapping[str, object]],
    heartbeat_fresh: bool,
    internet_checked_at: str,
    backend_checked_at: str,
    state_changed_at: str,
    reported_at: Optional[str] = None,
) -> PiDeviceState:
    worker_snapshot = worker_snapshot or {}
    worker_state = str(worker_snapshot.get("worker_state") or "idle")
    activity = activity_status_from_worker_state(worker_state)
    heartbeat_at = str(worker_snapshot.get("updated_at") or "").strip() or None
    document_key = str(worker_snapshot.get("document_key") or "").strip() or None
    document_label = (
        " ".join(str(worker_snapshot.get("document_label") or "").split()).strip()
        or "No active document"
    )
    request_owner_name = (
        " ".join(str(worker_snapshot.get("request_owner_name") or "").split()).strip()
        or None
    )
    return PiDeviceState(
        device_id=str(device_id).strip(),
        internet_status=internet_status,
        backend_status=backend_status,
        worker_status=worker_status_from_state(
            worker_state,
            heartbeat_fresh=heartbeat_fresh,
        ),
        activity=activity,
        worker_state=worker_state,
        camera_status=str(worker_snapshot.get("camera_status") or "unavailable"),
        document_key=document_key,
        document_label=document_label,
        request_owner_name=request_owner_name,
        heartbeat_at=heartbeat_at,
        internet_checked_at=internet_checked_at,
        backend_checked_at=backend_checked_at,
        state_changed_at=state_changed_at,
        reported_at=reported_at or utc_timestamp(),
        safe_error_code=(
            str(worker_snapshot.get("safe_error_code") or "").strip() or None
        ),
    )


__all__ = [
    "ACTIVITY_STATUSES",
    "ACTIVITY_TEXT",
    "BACKEND_STATUSES",
    "DEVICE_STATE_SCHEMA_VERSION",
    "INTERNET_STATUSES",
    "PiDeviceState",
    "WORKER_STATUSES",
    "activity_status_from_worker_state",
    "activity_text",
    "backend_status_from_probe",
    "build_device_state",
    "internet_status_from_probes",
    "utc_timestamp",
    "worker_status_from_state",
]
