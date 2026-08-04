"""
Fast, preview-first Raspberry Pi camera controller for SMaRT-PDM.
"""

from __future__ import annotations

import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Iterable


def _env_int(name: str, default: int, minimum: int) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return max(minimum, default)


def _env_float(name: str, default: float, minimum: float) -> float:
    try:
        return max(minimum, float(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return max(minimum, default)


class CameraController:
    def __init__(self):
        self.preview_process = None
        self.is_previewing = False
        self.capture_file = os.getenv(
            "CAMERA_CAPTURE_FILE",
            "/tmp/raw_capture.jpg",
        )
        self.capture_width = _env_int(
            "CAMERA_CAPTURE_WIDTH",
            2592,
            960,
        )
        self.capture_height = _env_int(
            "CAMERA_CAPTURE_HEIGHT",
            1944,
            720,
        )
        self.capture_quality = min(
            100,
            _env_int("CAMERA_CAPTURE_QUALITY", 92, 60),
        )
        self.capture_timeout_ms = _env_int(
            "CAMERA_CAPTURE_TIMEOUT_MS",
            800,
            250,
        )
        self.preview_startup_seconds = _env_float(
            "CAMERA_PREVIEW_STARTUP_SECONDS",
            0.65,
            0.20,
        )
        self.release_settle_seconds = _env_float(
            "CAMERA_RELEASE_SETTLE_SECONDS",
            0.12,
            0.0,
        )
        self.command_timeout_seconds = _env_float(
            "CAMERA_COMMAND_TIMEOUT_SECONDS",
            15.0,
            5.0,
        )

    @staticmethod
    def _run_quiet(
        command: Iterable[str],
        *,
        timeout: float,
    ) -> subprocess.CompletedProcess:
        return subprocess.run(
            list(command),
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    def clear_hardware(self) -> None:
        """Stop stale camera processes owned by this service user."""
        uid = str(os.getuid())

        for process_name in (
            "rpicam-vid",
            "rpicam-still",
            "rpicam-hello",
        ):
            try:
                subprocess.run(
                    [
                        "pkill",
                        "-TERM",
                        "-u",
                        uid,
                        "-x",
                        process_name,
                    ],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=2,
                )
            except (OSError, subprocess.TimeoutExpired):
                pass

    def check_available(self) -> bool:
        try:
            result = self._run_quiet(
                ["rpicam-still", "--list-cameras"],
                timeout=10,
            )
        except (OSError, subprocess.TimeoutExpired):
            print("No camera detected.")
            return False

        output = f"{result.stdout}\n{result.stderr}"

        if (
            result.returncode != 0
            or "No cameras" in output
        ):
            print("No camera detected.")
            return False

        print("Camera detected.")
        return True

    def start_preview(self) -> bool:
        if (
            self.preview_process is not None
            and self.preview_process.poll() is None
        ):
            self.is_previewing = True
            return True

        self.clear_hardware()
        print("Starting preview on HDMI...")

        command = [
            "rpicam-hello",
            "-t",
            "0",
            "--autofocus-mode",
            "continuous",
        ]

        try:
            self.preview_process = subprocess.Popen(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except OSError:
            self.preview_process = None
            self.is_previewing = False
            return False

        deadline = time.monotonic() + self.preview_startup_seconds

        while time.monotonic() < deadline:
            if self.preview_process.poll() is not None:
                self.preview_process = None
                self.is_previewing = False
                return False
            time.sleep(0.05)

        self.is_previewing = True
        print("Preview active")
        return True

    def stop_preview(self) -> None:
        process = self.preview_process
        self.preview_process = None
        self.is_previewing = False

        if process is None or process.poll() is not None:
            return

        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            process.wait(timeout=1.0)
        except Exception:
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass

        if self.release_settle_seconds > 0:
            time.sleep(self.release_settle_seconds)

    def capture_image(self, *, restart_preview: bool = True) -> bool:
        was_previewing = self.is_previewing
        print("\nFinalizing capture...")
        self.stop_preview()

        capture_path = self.capture_file

        try:
            if os.path.exists(capture_path):
                os.remove(capture_path)
        except OSError:
            pass

        command = [
            "rpicam-still",
            "-o",
            capture_path,
            "--width",
            str(self.capture_width),
            "--height",
            str(self.capture_height),
            "--quality",
            str(self.capture_quality),
            "-t",
            str(self.capture_timeout_ms),
            "--autofocus-mode",
            "continuous",
            "--awb",
            "auto",
            "--denoise",
            "cdn_off",
        ]

        started_at = time.monotonic()

        try:
            result = self._run_quiet(
                command,
                timeout=self.command_timeout_seconds,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            print(f"Capture failed: {exc}")
            result = None

        elapsed = time.monotonic() - started_at
        output_exists = False

        try:
            output_exists = os.path.exists(capture_path)
        except OSError:
            output_exists = False

        if (
            result is None
            or result.returncode != 0
            or not output_exists
        ):
            error_text = ""

            if result is not None:
                error_text = str(
                    getattr(result, "stderr", "")
                    or getattr(result, "stdout", "")
                    or ""
                )

            print(f"Capture failed:\n{error_text[-1000:]}")

            if was_previewing and restart_preview:
                self.start_preview()

            return False

        try:
            size_kb = os.path.getsize(capture_path) // 1024
        except OSError:
            size_kb = 0

        print(
            f"Captured ({size_kb} KB) in {elapsed:.2f}s "
            f"-> {capture_path}"
        )

        if was_previewing and restart_preview:
            self.start_preview()

        return True

    def cleanup(self) -> None:
        self.stop_preview()
