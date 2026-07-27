"""Safe, read-only access to the worker-state JSON contract."""

from __future__ import annotations

import json
import os
import stat
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, Optional, Union

from runtime.state_publisher import resolve_default_state_path
from runtime.worker_state import CAMERA_STATUSES, SCHEMA_VERSION, WORKER_STATES

MAX_STATE_BYTES = 64 * 1024
DEFAULT_STALE_AFTER_SECONDS = 15.0

_ALLOWED_KEYS = frozenset(
    {
        "schema_version",
        "sequence",
        "worker_state",
        "request_reference",
        "application_reference",
        "document_key",
        "document_label",
        "camera_status",
        "safe_message",
        "failure_stage",
        "safe_error_code",
        "updated_at",
    }
)


@dataclass(frozen=True)
class ReadResult:
    """Result of reading one state snapshot without exposing unsafe fields."""

    status: str
    snapshot: Optional[Dict[str, object]] = None
    error_code: Optional[str] = None

    @property
    def available(self) -> bool:
        return self.status in {"available", "stale"} and self.snapshot is not None


class StateReader:
    """Read and validate the worker-state file without controlling the worker."""

    def __init__(
        self,
        *,
        state_path: Optional[Union[os.PathLike, str]] = None,
        stale_after_seconds: float = DEFAULT_STALE_AFTER_SECONDS,
        now_provider: Optional[Callable[[], datetime]] = None,
        require_private_permissions: Optional[bool] = None,
    ) -> None:
        self.state_path = Path(
            state_path
            or os.getenv("SMART_PDM_OCR_STATE_PATH")
            or resolve_default_state_path()
        )
        self.stale_after_seconds = max(float(stale_after_seconds), 1.0)
        self.now_provider = now_provider or (lambda: datetime.now(timezone.utc))
        self.require_private_permissions = (
            os.name == "posix"
            if require_private_permissions is None
            else bool(require_private_permissions)
        )

    def read(self) -> ReadResult:
        try:
            file_stat = self.state_path.lstat()
        except FileNotFoundError:
            return ReadResult(status="missing", error_code="state_file_missing")
        except OSError:
            return ReadResult(status="invalid", error_code="state_file_unreadable")

        if stat.S_ISLNK(file_stat.st_mode):
            return ReadResult(status="invalid", error_code="state_file_symlink")
        if not stat.S_ISREG(file_stat.st_mode):
            return ReadResult(status="invalid", error_code="state_file_not_regular")

        if self.require_private_permissions:
            if file_stat.st_uid != os.getuid():
                return ReadResult(status="invalid", error_code="state_file_wrong_owner")
            if stat.S_IMODE(file_stat.st_mode) & 0o077:
                return ReadResult(status="invalid", error_code="state_file_not_private")

        if file_stat.st_size <= 0 or file_stat.st_size > MAX_STATE_BYTES:
            return ReadResult(status="invalid", error_code="state_file_size_invalid")

        try:
            raw = self.state_path.read_bytes()
        except OSError:
            return ReadResult(status="invalid", error_code="state_file_unreadable")

        if len(raw) > MAX_STATE_BYTES:
            return ReadResult(status="invalid", error_code="state_file_size_invalid")

        try:
            decoded = raw.decode("utf-8")
            payload = json.loads(decoded)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return ReadResult(status="invalid", error_code="state_json_invalid")

        if not isinstance(payload, dict):
            return ReadResult(status="invalid", error_code="state_payload_invalid")

        validated = self._validate_payload(payload)
        if validated is None:
            return ReadResult(status="invalid", error_code="state_contract_invalid")

        if self._is_stale(validated["updated_at"]):
            return ReadResult(status="stale", snapshot=validated, error_code="state_stale")

        return ReadResult(status="available", snapshot=validated)

    def _validate_payload(self, payload: Dict[str, object]) -> Optional[Dict[str, object]]:
        safe = {key: payload.get(key) for key in _ALLOWED_KEYS}

        if safe["schema_version"] != SCHEMA_VERSION:
            return None
        if not isinstance(safe["sequence"], int) or safe["sequence"] < 1:
            return None
        if safe["worker_state"] not in WORKER_STATES:
            return None
        if safe["camera_status"] not in CAMERA_STATUSES:
            return None

        message = self._bounded_text(safe["safe_message"], 240)
        updated_at = self._bounded_text(safe["updated_at"], 64)
        if not message or not updated_at:
            return None

        normalized: Dict[str, object] = {
            "schema_version": SCHEMA_VERSION,
            "sequence": safe["sequence"],
            "worker_state": safe["worker_state"],
            "request_reference": self._bounded_text(
                safe["request_reference"], 128
            ),
            "application_reference": self._bounded_text(
                safe["application_reference"], 128
            ),
            "document_key": self._bounded_text(safe["document_key"], 80),
            "document_label": self._bounded_text(
                safe["document_label"], 120
            )
            or "Document",
            "camera_status": safe["camera_status"],
            "safe_message": message,
            "failure_stage": self._bounded_text(safe["failure_stage"], 80),
            "safe_error_code": self._bounded_text(safe["safe_error_code"], 80),
            "updated_at": updated_at,
        }

        if normalized["failure_stage"] not in WORKER_STATES:
            normalized["failure_stage"] = None

        return normalized

    def _is_stale(self, updated_at: object) -> bool:
        timestamp = self._parse_timestamp(str(updated_at))
        if timestamp is None:
            return True
        age = (self.now_provider() - timestamp).total_seconds()
        return age > self.stale_after_seconds

    @staticmethod
    def _parse_timestamp(value: str) -> Optional[datetime]:
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _bounded_text(value: object, maximum_length: int) -> Optional[str]:
        if value is None:
            return None
        text = " ".join(str(value).replace("\x00", " ").split()).strip()
        if not text:
            return None
        return text[:maximum_length]


__all__ = [
    "DEFAULT_STALE_AFTER_SECONDS",
    "MAX_STATE_BYTES",
    "ReadResult",
    "StateReader",
]
