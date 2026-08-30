#!/usr/bin/env python3
"""Launch the Pi status GUI only after a real local graphical session exists."""

from __future__ import annotations

import os
import stat
import sys
import time
from pathlib import Path
from typing import Mapping, Optional


PROJECT_ROOT = Path(
    os.environ.get(
        "SMART_PDM_PROJECT_ROOT",
        "/home/smart_pdm/birth-certificate-acceptance/ocr/scanner",
    )
).resolve()
WAIT_SECONDS = max(
    10,
    int(os.environ.get("SMART_PDM_DISPLAY_WAIT_SECONDS", "120")),
)
GRAPHICAL_KEYS = (
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "XDG_RUNTIME_DIR",
    "DBUS_SESSION_BUS_ADDRESS",
    "XAUTHORITY",
)


def _is_socket(path: Path) -> bool:
    try:
        return stat.S_ISSOCK(path.stat().st_mode)
    except OSError:
        return False


def _display_socket(env: Mapping[str, str]) -> Optional[Path]:
    display = str(env.get("DISPLAY") or "").strip()
    if not display:
        return None

    # Local X/XWayland display, e.g. :0 or :0.0.
    if display.startswith(":"):
        number = display[1:].split(".", 1)[0]
        if number.isdigit():
            return Path(f"/tmp/.X11-unix/X{number}")

    # Non-local X displays do not use the local Unix socket. They are not the
    # normal Pi kiosk path, but keep them eligible if explicitly configured.
    return Path("/")


def _wayland_socket(env: Mapping[str, str]) -> Optional[Path]:
    display = str(env.get("WAYLAND_DISPLAY") or "").strip()
    if not display:
        return None
    candidate = Path(display)
    if candidate.is_absolute():
        return candidate
    runtime = str(env.get("XDG_RUNTIME_DIR") or "").strip()
    if not runtime:
        return None
    return Path(runtime) / display


def graphical_environment_usable(env: Mapping[str, str]) -> bool:
    wayland = _wayland_socket(env)
    if wayland is not None and _is_socket(wayland):
        return True

    x_socket = _display_socket(env)
    if x_socket is not None:
        if x_socket == Path("/"):
            return True
        if _is_socket(x_socket):
            return True

    return False


def _process_environment(path: Path) -> Optional[dict[str, str]]:
    try:
        raw = (path / "environ").read_bytes()
    except OSError:
        return None

    result: dict[str, str] = {}
    for item in raw.split(b"\0"):
        if b"=" not in item:
            continue
        key, value = item.split(b"=", 1)
        result[key.decode(errors="ignore")] = value.decode(errors="ignore")
    return result


def discover_graphical_environment() -> Optional[dict[str, str]]:
    current = dict(os.environ)
    if graphical_environment_usable(current):
        return {
            key: current[key]
            for key in GRAPHICAL_KEYS
            if current.get(key)
        }

    uid = os.getuid()
    candidates: list[tuple[int, dict[str, str]]] = []
    try:
        proc_entries = list(Path("/proc").iterdir())
    except OSError:
        return None

    for entry in proc_entries:
        if not entry.name.isdigit():
            continue
        try:
            if entry.stat().st_uid != uid:
                continue
        except OSError:
            continue
        env = _process_environment(entry)
        if not env or not graphical_environment_usable(env):
            continue
        score = 0
        if env.get("WAYLAND_DISPLAY"):
            score += 4
        if env.get("DISPLAY"):
            score += 3
        if env.get("DBUS_SESSION_BUS_ADDRESS"):
            score += 2
        if env.get("XAUTHORITY"):
            score += 1
        candidates.append((score, env))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    selected = candidates[0][1]
    return {
        key: selected[key]
        for key in GRAPHICAL_KEYS
        if selected.get(key)
    }


def tkinter_available() -> bool:
    try:
        import tkinter  # noqa: F401
    except Exception:
        return False
    return True


def main() -> int:
    deadline = time.monotonic() + WAIT_SECONDS
    app_path = PROJECT_ROOT / "gui" / "app.py"

    if not tkinter_available():
        print("gui_service_ready=false", flush=True)
        print("reason=tkinter_unavailable", flush=True)
        return 1

    selected_environment: Optional[dict[str, str]] = None
    while time.monotonic() < deadline:
        if app_path.is_file():
            selected_environment = discover_graphical_environment()
            if selected_environment:
                break
        time.sleep(1.0)

    if not selected_environment:
        print("gui_service_ready=false", flush=True)
        print("reason=graphical_session_unavailable", flush=True)
        return 1

    os.environ.update(selected_environment)
    runtime_directory = Path(
        os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")
    )
    smart_pdm_runtime = runtime_directory / "smart_pdm"
    smart_pdm_runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(smart_pdm_runtime, 0o700)

    os.environ["SMART_PDM_RUNTIME_DIRECTORY"] = str(smart_pdm_runtime)
    os.environ["SMART_PDM_DEVICE_STATE_PATH"] = str(
        smart_pdm_runtime / "device_state.json"
    )
    os.environ["SMART_PDM_OCR_ACTIVITY_PATH"] = str(
        smart_pdm_runtime / "worker_activity.json"
    )
    os.environ["PYTHONUNBUFFERED"] = "1"

    os.chdir(PROJECT_ROOT)
    print("gui_service_ready=true", flush=True)
    print("graphical_session=detected", flush=True)
    print("network_startup_dependency=false", flush=True)

    os.execvpe(
        "/usr/bin/python3",
        ["/usr/bin/python3", "-m", "gui.app"],
        os.environ,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
