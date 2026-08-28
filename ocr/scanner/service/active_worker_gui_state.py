#!/usr/bin/env python3
"""Publish one consolidated, privacy-safe state for the Pi touchscreen.

The monitor never controls the camera, claims requests, or runs OCR. It reads
the worker's local heartbeat, performs bounded connectivity probes, and writes
an atomic device-state snapshot consumed by the read-only GUI.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import sys
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs):
        return False


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from runtime.device_state import (  # noqa: E402
    backend_status_from_probe,
    build_device_state,
    internet_status_from_probes,
    utc_timestamp,
)

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=True)

RUNTIME_UID = getattr(os, "getuid", lambda: 0)()
RUNTIME_DIRECTORY = Path(
    os.environ.get("SMART_PDM_RUNTIME_DIRECTORY", f"/run/user/{RUNTIME_UID}/smart_pdm")
)
STATE_PATH = Path(
    os.environ.get("SMART_PDM_DEVICE_STATE_PATH", str(RUNTIME_DIRECTORY / "device_state.json"))
)
ACTIVITY_PATH = Path(
    os.environ.get("SMART_PDM_OCR_ACTIVITY_PATH", str(RUNTIME_DIRECTORY / "worker_activity.json"))
)
LOG_PATH = STATE_PATH.parent / "device_state_monitor.log"

MONITOR_INTERVAL_SECONDS = min(
    0.50,
    max(0.10, float(os.environ.get("SMART_PDM_GUI_STATE_INTERVAL_SECONDS", "0.25"))),
)
DEVICE_HEARTBEAT_SECONDS = min(
    3.0,
    max(2.0, float(os.environ.get("SMART_PDM_DEVICE_HEARTBEAT_SECONDS", "2.5"))),
)
WORKER_HEARTBEAT_STALE_SECONDS = max(
    6.0,
    float(os.environ.get("SMART_PDM_WORKER_STALE_SECONDS", "7.5")),
)
MAX_ACTIVITY_BYTES = 64 * 1024

_running = True


@dataclass(frozen=True)
class ProbeConfig:
    public_urls: tuple[str, str]
    backend_health_url: str
    interval_seconds: float
    timeout_seconds: float


def resolve_device_id(configured_value: Optional[str] = None) -> str:
    configured = str(
        configured_value
        if configured_value is not None
        else os.environ.get("IOT_DEVICE_ID", "")
    ).strip()
    if configured:
        return configured
    identity = ""
    for path in (Path("/etc/machine-id"), Path("/var/lib/dbus/machine-id")):
        try:
            identity = path.read_text(encoding="utf-8").strip()
        except OSError:
            identity = ""
        if identity:
            break
    identity = identity or socket.gethostname().strip() or "unknown-device"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://smart-pdm.local/iot-device/{identity}"))


def _validated_https_url(value: object, name: str) -> str:
    url = str(value or "").strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"{name} must be a valid HTTPS URL")
    return url


def load_probe_config(environ: Optional[dict[str, str]] = None) -> ProbeConfig:
    values = os.environ if environ is None else environ
    first = _validated_https_url(
        values.get("PUBLIC_INTERNET_PROBE_URL_1"), "PUBLIC_INTERNET_PROBE_URL_1"
    )
    second = _validated_https_url(
        values.get("PUBLIC_INTERNET_PROBE_URL_2"), "PUBLIC_INTERNET_PROBE_URL_2"
    )
    if first == second:
        raise ValueError("public Internet probe URLs must be different")
    base_url = _validated_https_url(
        values.get("RENDER_API_BASE_URL"), "RENDER_API_BASE_URL"
    ).rstrip("/")
    backend_host = urlparse(base_url).netloc.lower()
    if any(urlparse(url).netloc.lower() == backend_host for url in (first, second)):
        raise ValueError("public Internet probes must not use the SMaRT-PDM backend")
    interval = max(
        5.0, float(values.get("PUBLIC_INTERNET_PROBE_INTERVAL_SECONDS", "5"))
    )
    timeout = min(
        2.0,
        max(0.5, float(values.get("PUBLIC_INTERNET_PROBE_TIMEOUT_SECONDS", "2"))),
    )
    return ProbeConfig(
        public_urls=(first, second),
        backend_health_url=f"{base_url}/api/health",
        interval_seconds=interval,
        timeout_seconds=timeout,
    )


def log(message: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line, flush=True)
    try:
        STATE_PATH.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
        os.chmod(LOG_PATH, 0o600)
    except OSError:
        pass


def request_shutdown(_signal_number: int, _frame: object) -> None:
    global _running
    _running = False


def _https_request_succeeds(url: str, timeout: float) -> bool:
    session = requests.Session()
    session.trust_env = False
    session.max_redirects = 3
    try:
        with session.get(
            url,
            timeout=(timeout, timeout),
            allow_redirects=True,
            stream=True,
            headers={"User-Agent": "SMaRT-PDM-Pi-Status/1"},
        ) as response:
            return 200 <= response.status_code < 400
    except requests.RequestException:
        return False
    finally:
        session.close()


def run_connectivity_probes(
    config: ProbeConfig,
    requester: Callable[[str, float], bool] = _https_request_succeeds,
) -> tuple[str, str]:
    urls = (*config.public_urls, config.backend_health_url)
    with ThreadPoolExecutor(max_workers=3, thread_name_prefix="pi-status-probe") as pool:
        results = list(
            pool.map(lambda url: bool(requester(url, config.timeout_seconds)), urls)
        )
    internet = internet_status_from_probes(results[0], results[1])
    backend = backend_status_from_probe(internet, results[2])
    return internet, backend


def read_worker_activity(
    path: Path = ACTIVITY_PATH, *, now: Optional[float] = None
) -> tuple[Optional[dict[str, object]], bool]:
    try:
        file_stat = path.stat()
        if not path.is_file() or file_stat.st_size <= 0 or file_stat.st_size > MAX_ACTIVITY_BYTES:
            return None, False
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None, False
    if not isinstance(payload, dict):
        return None, False
    required = {"schema_version", "worker_state", "camera_status", "updated_at"}
    if not required.issubset(payload):
        return None, False
    age = (time.time() if now is None else now) - file_stat.st_mtime
    return payload, age <= WORKER_HEARTBEAT_STALE_SECONDS


def atomic_write(payload: dict[str, object], path: Path = STATE_PATH) -> None:
    parent = path.parent
    if parent.exists() and parent.is_symlink():
        raise RuntimeError("state directory cannot be a symbolic link")
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(parent, 0o700)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".device_state.", suffix=".tmp", dir=str(parent), text=True
    )
    temporary_path = Path(temporary_name)
    descriptor_open = True
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            descriptor_open = False
            if hasattr(os, "fchmod"):
                os.fchmod(handle.fileno(), 0o600)
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        os.chmod(path, 0o600)
    finally:
        if descriptor_open:
            os.close(descriptor)
        temporary_path.unlink(missing_ok=True)


def semantic_signature(payload: dict[str, object]) -> tuple[object, ...]:
    return tuple(
        payload.get(key)
        for key in (
            "internet_status",
            "backend_status",
            "worker_status",
            "activity",
            "worker_state",
            "camera_status",
            "document_key",
            "document_label",
            "safe_error_code",
        )
    )


def monitor(*, once: bool = False) -> int:
    config = load_probe_config()
    device_id = resolve_device_id()
    internet_status = "offline"
    backend_status = "no_internet"
    internet_checked_at = utc_timestamp()
    backend_checked_at = internet_checked_at
    state_changed_at = internet_checked_at
    last_probe_at = 0.0
    last_publish_at = 0.0
    last_signature: Optional[tuple[object, ...]] = None

    while _running:
        monotonic_now = time.monotonic()
        if last_probe_at == 0.0 or monotonic_now - last_probe_at >= config.interval_seconds:
            internet_status, backend_status = run_connectivity_probes(config)
            internet_checked_at = utc_timestamp()
            backend_checked_at = internet_checked_at
            last_probe_at = time.monotonic()

        worker_snapshot, heartbeat_fresh = read_worker_activity()
        device_state = build_device_state(
            device_id=device_id,
            internet_status=internet_status,
            backend_status=backend_status,
            worker_snapshot=worker_snapshot,
            heartbeat_fresh=heartbeat_fresh,
            internet_checked_at=internet_checked_at,
            backend_checked_at=backend_checked_at,
            state_changed_at=state_changed_at,
        )
        payload = device_state.to_dict()
        signature = semantic_signature(payload)
        if signature != last_signature:
            state_changed_at = utc_timestamp()
            payload["state_changed_at"] = state_changed_at
            payload["activity_state"]["changed_at"] = state_changed_at

        publish_due = monotonic_now - last_publish_at >= DEVICE_HEARTBEAT_SECONDS
        if signature != last_signature or publish_due:
            atomic_write(payload)
            last_publish_at = time.monotonic()
            last_signature = signature

        if once:
            return 0
        time.sleep(MONITOR_INTERVAL_SECONDS)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)
    try:
        log("device_state_monitor_started")
        result = monitor(once=args.once)
        log("device_state_monitor_stopped")
        return result
    except Exception as error:
        log(f"device_state_monitor_error type={type(error).__name__} message={error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
