"""Bounded, read-only validation for the consolidated Pi device state."""

from __future__ import annotations

import json
import os
import stat
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

from runtime.device_state import (
    ACTIVITY_STATUSES,
    BACKEND_STATUSES,
    DEVICE_STATE_SCHEMA_VERSION,
    INTERNET_STATUSES,
    WORKER_STATUSES,
)

MAX_STATE_BYTES = 64 * 1024
DEFAULT_STALE_AFTER_SECONDS = 8.0
DEFAULT_WORKER_ACTIVITY_STALE_AFTER_SECONDS = 3.0
WORKER_CAMERA_STATUSES = frozenset({
    "checking", "ready", "starting", "preview_active",
    "capture_in_progress", "captured", "error", "unavailable", "stopped",
})


def default_state_path() -> Path:
    runtime_uid = getattr(os, "getuid", lambda: 0)()
    runtime_directory = os.environ.get(
        "SMART_PDM_RUNTIME_DIRECTORY", f"/run/user/{runtime_uid}/smart_pdm"
    )
    return Path(
        os.environ.get(
            "SMART_PDM_DEVICE_STATE_PATH",
            str(Path(runtime_directory) / "device_state.json"),
        )
    )


def default_worker_activity_path() -> Path:
    runtime_uid = getattr(os, "getuid", lambda: 0)()
    runtime_directory = os.environ.get(
        "SMART_PDM_RUNTIME_DIRECTORY", f"/run/user/{runtime_uid}/smart_pdm"
    )
    return Path(
        os.environ.get(
            "SMART_PDM_OCR_ACTIVITY_PATH",
            str(Path(runtime_directory) / "worker_activity.json"),
        )
    )


@dataclass(frozen=True)
class ReadResult:
    status: str
    snapshot: Optional[dict[str, object]] = None
    error_code: Optional[str] = None


class StateReader:
    def __init__(
        self,
        *,
        state_path: Optional[Union[os.PathLike, str]] = None,
        worker_activity_path: Optional[Union[os.PathLike, str]] = None,
        stale_after_seconds: float = DEFAULT_STALE_AFTER_SECONDS,
        worker_activity_stale_after_seconds: float = DEFAULT_WORKER_ACTIVITY_STALE_AFTER_SECONDS,
        require_private_permissions: Optional[bool] = None,
    ) -> None:
        self.state_path = Path(state_path or default_state_path())
        self.worker_activity_path = Path(
            worker_activity_path or default_worker_activity_path()
        )
        self.stale_after_seconds = max(1.0, float(stale_after_seconds))
        self.worker_activity_stale_after_seconds = max(
            0.5, float(worker_activity_stale_after_seconds)
        )
        self.require_private_permissions = (
            os.name == "posix"
            if require_private_permissions is None
            else bool(require_private_permissions)
        )

    def read(self) -> ReadResult:
        try:
            file_stat = self.state_path.lstat()
        except FileNotFoundError:
            return ReadResult("missing", error_code="device_state_missing")
        except OSError:
            return ReadResult("invalid", error_code="device_state_unreadable")
        if stat.S_ISLNK(file_stat.st_mode) or not stat.S_ISREG(file_stat.st_mode):
            return ReadResult("invalid", error_code="device_state_not_regular")
        if file_stat.st_size <= 0 or file_stat.st_size > MAX_STATE_BYTES:
            return ReadResult("invalid", error_code="device_state_size_invalid")
        if self.require_private_permissions:
            if hasattr(file_stat, "st_uid") and file_stat.st_uid != os.getuid():
                return ReadResult("invalid", error_code="device_state_wrong_owner")
            if stat.S_IMODE(file_stat.st_mode) & 0o077:
                return ReadResult("invalid", error_code="device_state_not_private")
        try:
            payload = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return ReadResult("invalid", error_code="device_state_json_invalid")
        if not self._valid(payload):
            return ReadResult("invalid", error_code="device_state_contract_invalid")
        age = max(0.0, time.time() - file_stat.st_mtime)
        if age > self.stale_after_seconds:
            return ReadResult("stale", snapshot=payload, error_code="device_state_stale")
        return ReadResult("available", snapshot=payload)

    def read_worker_camera_status(self) -> Optional[str]:
        """Read the local worker camera handoff without waiting on network probes."""

        path = self.worker_activity_path
        try:
            file_stat = path.lstat()
        except OSError:
            return None
        if stat.S_ISLNK(file_stat.st_mode) or not stat.S_ISREG(file_stat.st_mode):
            return None
        if file_stat.st_size <= 0 or file_stat.st_size > MAX_STATE_BYTES:
            return None
        if self.require_private_permissions:
            if hasattr(file_stat, "st_uid") and file_stat.st_uid != os.getuid():
                return None
            if stat.S_IMODE(file_stat.st_mode) & 0o077:
                return None
        age = max(0.0, time.time() - file_stat.st_mtime)
        if age > self.worker_activity_stale_after_seconds:
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict):
            return None
        camera_status = str(payload.get("camera_status") or "").strip()
        if camera_status not in WORKER_CAMERA_STATUSES:
            return None
        return camera_status

    @staticmethod
    def _valid(payload: object) -> bool:
        if not isinstance(payload, dict):
            return False
        return bool(
            payload.get("schema_version") == DEVICE_STATE_SCHEMA_VERSION
            and str(payload.get("device_id") or "").strip()
            and payload.get("internet_status") in INTERNET_STATUSES
            and payload.get("backend_status") in BACKEND_STATUSES
            and payload.get("worker_status") in WORKER_STATUSES
            and payload.get("activity") in ACTIVITY_STATUSES
            and str(payload.get("reported_at") or "").strip()
        )


__all__ = [
    "DEFAULT_STALE_AFTER_SECONDS",
    "DEFAULT_WORKER_ACTIVITY_STALE_AFTER_SECONDS",
    "ReadResult",
    "StateReader",
    "default_worker_activity_path",
]
