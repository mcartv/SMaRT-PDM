"""Atomic, failure-isolated publication of Raspberry Pi OCR worker state."""

from __future__ import annotations

import json
import logging
import os
import stat
import tempfile
import threading
from pathlib import Path
from typing import Optional, Union

from runtime.worker_state import WorkerStateSnapshot, build_worker_state

DEFAULT_HEARTBEAT_SECONDS = 5.0


class UnsafeStatePathError(RuntimeError):
    """Raised when the state target is unsafe to replace."""


def resolve_default_state_path(*, uid: Optional[int] = None) -> Path:
    resolved_uid = os.getuid() if uid is None else int(uid)
    runtime_root = Path(f"/run/user/{resolved_uid}")
    if (
        runtime_root.is_dir()
        and os.access(runtime_root, os.W_OK | os.X_OK)
        and runtime_root.stat().st_uid == resolved_uid
    ):
        return runtime_root / "smart_pdm" / "ocr_state.json"
    return Path(f"/tmp/smart_pdm_ocr_state_{resolved_uid}.json")


class NullStatePublisher:
    """No-op publisher used by tests and explicit state-disabled runtimes."""

    last_error_code: Optional[str] = None

    def start_heartbeat(self) -> None:
        return None

    def publish(self, **_values) -> bool:
        return True

    def close(self) -> None:
        return None


class StatePublisher:
    """Publish the current worker state without becoming a worker dependency."""

    def __init__(
        self,
        *,
        state_path: Optional[Union[os.PathLike[str], str]] = None,
        heartbeat_seconds: float = DEFAULT_HEARTBEAT_SECONDS,
        logger: Optional[logging.Logger] = None,
        uid: Optional[int] = None,
    ) -> None:
        self.state_path = Path(
            state_path
            or os.getenv("SMART_PDM_OCR_STATE_PATH")
            or resolve_default_state_path(uid=uid)
        )
        self.heartbeat_seconds = max(float(heartbeat_seconds), 0.1)
        self.logger = logger or logging.getLogger("iot-worker-state")
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._sequence = 0
        self._current_values: Optional[dict[str, object]] = None
        self.last_error_code: Optional[str] = None

    def start_heartbeat(self) -> None:
        with self._lock:
            if self._heartbeat_thread and self._heartbeat_thread.is_alive():
                return
            self._stop_event.clear()
            self._heartbeat_thread = threading.Thread(
                target=self._heartbeat_loop,
                name="smart-pdm-worker-state-heartbeat",
                daemon=True,
            )
            self._heartbeat_thread.start()

    def publish(self, **values) -> bool:
        """Publish one state update; failures are reported safely and swallowed."""

        with self._lock:
            self._current_values = dict(values)
            return self._publish_locked(self._current_values)

    def close(self) -> None:
        self._stop_event.set()
        thread = self._heartbeat_thread
        if thread and thread.is_alive():
            thread.join(timeout=min(self.heartbeat_seconds + 0.5, 6.0))

    def _heartbeat_loop(self) -> None:
        while not self._stop_event.wait(self.heartbeat_seconds):
            with self._lock:
                if self._current_values is not None:
                    self._publish_locked(self._current_values)

    def _publish_locked(self, values: dict[str, object]) -> bool:
        try:
            self._sequence += 1
            snapshot = build_worker_state(
                sequence=self._sequence,
                **values,
            )
            self._atomic_write(snapshot)
            self.last_error_code = None
            return True
        except Exception:
            first_failure = self.last_error_code != "state_publish_failed"
            self.last_error_code = "state_publish_failed"
            if first_failure:
                self.logger.warning(
                    "Worker state publication failed code=state_publish_failed"
                )
            return False

    def _atomic_write(self, snapshot: WorkerStateSnapshot) -> None:
        target = self.state_path
        parent = target.parent

        self._prepare_parent(parent)
        self._reject_unsafe_target(target)

        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{target.name}.",
            suffix=".tmp",
            dir=str(parent),
            text=True,
        )
        temporary_path = Path(temporary_name)
        descriptor_open = True

        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as file:
                descriptor_open = False

                # POSIX supports descriptor-level permissions. Windows does not,
                # and attempting os.fchmod there can leave the temporary file
                # open and locked before atomic replacement.
                if os.name == "posix" and hasattr(os, "fchmod"):
                    os.fchmod(file.fileno(), 0o600)

                json.dump(
                    snapshot.to_dict(),
                    file,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                )
                file.write("\n")
                file.flush()
                os.fsync(file.fileno())

            # The file handle is closed before replacement. This is required on
            # Windows, where an open temporary file cannot be renamed/replaced.
            if os.name != "posix":
                os.chmod(temporary_path, 0o600)

            self._reject_unsafe_target(target)
            os.replace(temporary_path, target)
            os.chmod(target, 0o600)
            self._fsync_directory(parent)
        finally:
            if descriptor_open:
                try:
                    os.close(descriptor)
                except OSError:
                    pass
            try:
                temporary_path.unlink(missing_ok=True)
            except Exception:
                pass

    @staticmethod
    def _prepare_parent(parent: Path) -> None:
        if parent.exists() and parent.is_symlink():
            raise UnsafeStatePathError("state parent cannot be a symbolic link")

        if not parent.exists():
            parent.mkdir(mode=0o700, parents=True, exist_ok=False)

        if not parent.is_dir():
            raise UnsafeStatePathError("state parent is not a directory")

        # The dedicated runtime directory is private. The shared /tmp fallback
        # retains its system permissions while the state file itself is 0600.
        if parent.name == "smart_pdm":
            parent_stat = parent.stat()
            if parent_stat.st_uid != os.getuid():
                raise UnsafeStatePathError(
                    "state parent must be owned by the worker user"
                )
            os.chmod(parent, 0o700)

    @staticmethod
    def _reject_unsafe_target(target: Path) -> None:
        try:
            target_stat = target.lstat()
        except FileNotFoundError:
            return

        if stat.S_ISLNK(target_stat.st_mode):
            raise UnsafeStatePathError("state target cannot be a symbolic link")
        if not stat.S_ISREG(target_stat.st_mode):
            raise UnsafeStatePathError("state target must be a regular file")

    @staticmethod
    def _fsync_directory(parent: Path) -> None:
        try:
            descriptor = os.open(str(parent), os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


__all__ = [
    "DEFAULT_HEARTBEAT_SECONDS",
    "NullStatePublisher",
    "StatePublisher",
    "UnsafeStatePathError",
    "resolve_default_state_path",
]
