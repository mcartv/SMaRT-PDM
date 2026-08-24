#!/usr/bin/env python3
"""Publish the old GUI state contract from the active system OCR service.

This process never claims OCR requests, contacts Render, accesses document
images, or controls the camera. It only writes the privacy-safe status file
consumed by the original GUI.
"""

from __future__ import annotations

import argparse
import inspect
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path
from types import ModuleType
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_UID = getattr(os, "getuid", lambda: 0)()
STATE_PATH = Path(
    os.environ.get(
        "SMART_PDM_OCR_STATE_PATH",
        f"/run/user/{RUNTIME_UID}/smart_pdm/ocr_state.json",
    )
)
LOG_PATH = STATE_PATH.parent / "gui_state_bridge.log"
ACTIVITY_PATH = Path(
    os.environ.get(
        "SMART_PDM_OCR_ACTIVITY_PATH",
        str(STATE_PATH.parent / "worker_activity.json"),
    )
)
ACTIVITY_FRESH_SECONDS = 15
PUBLISH_INTERVAL_SECONDS = min(
    0.50,
    max(
        0.10,
        float(os.environ.get("SMART_PDM_GUI_STATE_INTERVAL_SECONDS", "0.25")),
    ),
)

_running = True


def log(message: str) -> None:
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
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


def production_worker_active() -> bool:
    try:
        completed = subprocess.run(
            [
                "/usr/bin/systemctl",
                "is-active",
                "--quiet",
                "ocr-start.service",
            ],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return False

    return completed.returncode == 0


def load_contract() -> ModuleType:
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))

    from runtime import worker_state

    return worker_state


def build_contract_payload(
    contract: ModuleType,
    *,
    sequence: int,
    active: bool,
) -> dict[str, Any]:
    if active and ACTIVITY_PATH.exists():
        try:
            age = time.time() - ACTIVITY_PATH.stat().st_mtime
            activity = json.loads(ACTIVITY_PATH.read_text(encoding="utf-8"))
            if age <= ACTIVITY_FRESH_SECONDS and isinstance(activity, dict):
                required = {"schema_version", "worker_state", "camera_status", "safe_message", "updated_at"}
                if required.issubset(activity):
                    activity["sequence"] = sequence
                    return activity
        except (OSError, ValueError, TypeError):
            pass

    candidate_values: dict[str, Any] = {
        "sequence": sequence,
        "worker_state": "idle" if active else "failed",
        "request_reference": None,
        "application_reference": None,
        "document_key": None,
        "document_label": "Document",
        "camera_status": "ready" if active else "unavailable",
        "safe_message": (
            "Scanner ready. Waiting for OCR request."
            if active
            else "The OCR worker service is not running."
        ),
        "failure_stage": None if active else "starting",
        "safe_error_code": None if active else "worker_service_inactive",
    }

    builder = contract.build_worker_state
    signature = inspect.signature(builder)
    parameters = signature.parameters

    accepts_extra_keywords = any(
        parameter.kind is inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )

    positional_arguments: list[Any] = []
    keyword_arguments: dict[str, Any] = {}
    missing_required: list[str] = []

    for name, parameter in parameters.items():
        if parameter.kind is inspect.Parameter.VAR_POSITIONAL:
            continue
        if parameter.kind is inspect.Parameter.VAR_KEYWORD:
            continue

        has_value = name in candidate_values

        if not has_value:
            if parameter.default is inspect.Parameter.empty:
                missing_required.append(name)
            continue

        value = candidate_values[name]

        if parameter.kind is inspect.Parameter.POSITIONAL_ONLY:
            positional_arguments.append(value)
        else:
            keyword_arguments[name] = value

    if accepts_extra_keywords:
        for name, value in candidate_values.items():
            keyword_arguments.setdefault(name, value)

    if missing_required:
        raise RuntimeError(
            "Unsupported worker-state contract; required parameters: "
            + ", ".join(missing_required)
        )

    snapshot = builder(*positional_arguments, **keyword_arguments)

    if hasattr(snapshot, "to_dict"):
        payload = snapshot.to_dict()
    elif isinstance(snapshot, dict):
        payload = dict(snapshot)
    else:
        raise TypeError(
            "build_worker_state returned unsupported type: "
            f"{type(snapshot).__name__}"
        )

    required_keys = {
        "schema_version",
        "sequence",
        "worker_state",
        "camera_status",
        "safe_message",
        "updated_at",
    }

    missing_keys = sorted(required_keys.difference(payload))

    if missing_keys:
        raise RuntimeError(
            "Generated state is missing required keys: "
            + ", ".join(missing_keys)
        )

    return payload


def atomic_write(payload: dict[str, Any]) -> None:
    parent = STATE_PATH.parent

    if parent.exists() and parent.is_symlink():
        raise RuntimeError("State directory cannot be a symbolic link")

    parent.mkdir(mode=0o700, parents=True, exist_ok=True)

    if hasattr(parent.stat(), "st_uid") and parent.stat().st_uid != RUNTIME_UID:
        raise RuntimeError("State directory has the wrong owner")

    os.chmod(parent, 0o700)

    if STATE_PATH.exists():
        file_stat = STATE_PATH.lstat()

        if STATE_PATH.is_symlink():
            raise RuntimeError("State file cannot be a symbolic link")

        if hasattr(file_stat, "st_uid") and file_stat.st_uid != RUNTIME_UID:
            raise RuntimeError("State file has the wrong owner")

    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".ocr_state.",
        suffix=".tmp",
        dir=str(parent),
        text=True,
    )
    temporary_path = Path(temporary_name)
    descriptor_open = True

    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            descriptor_open = False
            os.fchmod(handle.fileno(), 0o600)
            json.dump(
                payload,
                handle,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())

        os.replace(temporary_path, STATE_PATH)
        os.chmod(STATE_PATH, 0o600)
    finally:
        if descriptor_open:
            try:
                os.close(descriptor)
            except OSError:
                pass
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError:
            pass


def publish_once(contract: ModuleType, sequence: int) -> bool:
    active = production_worker_active()
    payload = build_contract_payload(
        contract,
        sequence=sequence,
        active=active,
    )
    atomic_write(payload)

    log(
        "state_published "
        f"worker={'active' if active else 'inactive'} "
        f"sequence={sequence} "
        f"path={STATE_PATH}"
    )

    return active


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--once",
        action="store_true",
        help="Write one state update and exit.",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    try:
        contract = load_contract()
        sequence = 1
        active = publish_once(contract, sequence)

        if args.once:
            return 0 if active else 2

        log("bridge_started")

        while _running:
            time.sleep(PUBLISH_INTERVAL_SECONDS)
            sequence += 1
            publish_once(contract, sequence)

        log("bridge_stopped")
        return 0
    except Exception as error:
        log(
            "bridge_error "
            f"type={type(error).__name__} "
            f"message={error}"
        )
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
