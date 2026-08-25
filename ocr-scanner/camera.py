"""Reliable Raspberry Pi camera capture with autofocus and quality gating.

The capture contract is strict:
1. The preview is stopped so the still pipeline owns the camera.
2. Autofocus must report a stable focused state when Picamera2 is available.
3. The saved image must pass file, resolution, brightness, and sharpness checks.
4. A failed focus/quality check is retried and never reported as captured.
"""

from __future__ import annotations

import logging
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Optional, Tuple

import cv2

log = logging.getLogger(__name__)


class CameraController:
    """Own the HDMI preview and produce one OCR-safe still image."""

    def __init__(self) -> None:
        self.preview_process: Optional[subprocess.Popen] = None
        self.is_previewing = False
        self.capture_file = os.getenv("PI_CAPTURE_FILE", "/tmp/raw_capture.jpg")
        self.capture_width = int(os.getenv("PI_CAPTURE_WIDTH", "2592"))
        self.capture_height = int(os.getenv("PI_CAPTURE_HEIGHT", "1944"))
        self.capture_quality = int(os.getenv("PI_CAPTURE_QUALITY", "95"))

        self.focus_timeout_seconds = float(os.getenv("PI_FOCUS_TIMEOUT_SECONDS", "10"))
        self.focus_stable_frames = max(1, int(os.getenv("PI_FOCUS_STABLE_FRAMES", "3")))
        self.max_capture_attempts = max(1, int(os.getenv("PI_CAPTURE_ATTEMPTS", "3")))
        self.minimum_file_bytes = max(1024, int(os.getenv("PI_MIN_CAPTURE_BYTES", "50000")))
        self.minimum_sharpness = float(os.getenv("PI_MIN_SHARPNESS", "65"))
        self.minimum_brightness = float(os.getenv("PI_MIN_BRIGHTNESS", "25"))
        self.maximum_brightness = float(os.getenv("PI_MAX_BRIGHTNESS", "235"))

        self.last_error_code: Optional[str] = None
        self.last_error_message: Optional[str] = None
        self.last_focus_state: Optional[str] = None
        self.last_quality: dict[str, Any] = {}

    def _set_error(self, code: str, message: str) -> None:
        self.last_error_code = code
        self.last_error_message = message
        log.error("%s: %s", code, message)

    def _reset_result(self) -> None:
        self.last_error_code = None
        self.last_error_message = None
        self.last_focus_state = None
        self.last_quality = {}

    def clear_hardware(self) -> None:
        """Terminate stale camera CLI processes without failing the scan."""
        subprocess.run(
            ["sudo", "killall", "-9", "rpicam-vid", "rpicam-still", "rpicam-hello"],
            stderr=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            check=False,
        )
        time.sleep(0.35)

    def check_available(self) -> bool:
        try:
            result = subprocess.run(
                ["rpicam-still", "--list-cameras"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            self._set_error("CAMERA_COMMAND_UNAVAILABLE", str(exc))
            return False

        output = f"{result.stdout}\n{result.stderr}"
        if result.returncode != 0 or "No cameras" in output or "Available cameras" not in output:
            self._set_error("CAMERA_UNAVAILABLE", output.strip() or "No camera detected")
            return False
        return True

    def start_preview(self) -> bool:
        self.clear_hardware()
        try:
            self.preview_process = subprocess.Popen(
                ["rpicam-hello", "-t", "0", "--autofocus-mode", "continuous"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except OSError as exc:
            self._set_error("PREVIEW_START_FAILED", str(exc))
            return False

        time.sleep(2)
        if self.preview_process.poll() is None:
            self.is_previewing = True
            return True

        self._set_error("PREVIEW_START_FAILED", "rpicam-hello exited before preview became active")
        self.preview_process = None
        return False

    def stop_preview(self) -> None:
        process = self.preview_process
        if process and process.poll() is None:
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                process.wait(timeout=3)
            except Exception:
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except Exception:
                    pass
        self.preview_process = None
        self.is_previewing = False
        self.clear_hardware()
        time.sleep(0.5)

    @staticmethod
    def _focus_state_name(value: Any) -> str:
        name = getattr(value, "name", None)
        if name:
            return str(name)
        return str(value)

    @staticmethod
    def _state_matches(value: Any, expected: Any, expected_name: str) -> bool:
        if expected is not None and value == expected:
            return True
        return CameraController._focus_state_name(value).lower().endswith(expected_name.lower())

    def _wait_for_picamera2_focus(self, camera: Any, controls: Any) -> bool:
        focused_state = getattr(getattr(controls, "AfState", None), "Focused", None)
        failed_state = getattr(getattr(controls, "AfState", None), "Failed", None)
        stable_count = 0
        deadline = time.monotonic() + self.focus_timeout_seconds

        while time.monotonic() < deadline:
            metadata = camera.capture_metadata()
            state = metadata.get("AfState")
            self.last_focus_state = self._focus_state_name(state)

            if self._state_matches(state, focused_state, "Focused"):
                stable_count += 1
                if stable_count >= self.focus_stable_frames:
                    return True
            else:
                stable_count = 0

            if self._state_matches(state, failed_state, "Failed"):
                return False
            time.sleep(0.12)
        return False

    def _capture_with_picamera2(self, destination: str) -> Tuple[bool, str]:
        try:
            from picamera2 import Picamera2
            from libcamera import controls
        except ImportError:
            return False, "PICAMERA2_UNAVAILABLE"

        camera = None
        try:
            camera = Picamera2()
            configuration = camera.create_still_configuration(
                main={"size": (self.capture_width, self.capture_height), "format": "RGB888"},
                buffer_count=3,
            )
            camera.configure(configuration)
            camera.set_controls(
                {
                    "AfMode": controls.AfModeEnum.Continuous,
                    "AwbEnable": True,
                }
            )
            camera.start()
            time.sleep(0.8)  # allow AE/AWB to begin converging before focus polling

            if not self._wait_for_picamera2_focus(camera, controls):
                return False, "AUTOFOCUS_NOT_LOCKED"

            camera.capture_file(destination)
            return True, ""
        except Exception as exc:
            log.exception("Picamera2 capture failed")
            return False, f"PICAMERA2_CAPTURE_ERROR:{exc}"
        finally:
            if camera is not None:
                try:
                    camera.stop()
                except Exception:
                    pass
                try:
                    camera.close()
                except Exception:
                    pass

    def _capture_with_rpicam_still(self, destination: str) -> Tuple[bool, str]:
        """Fallback for installations without Picamera2 Python bindings.

        The CLI cannot expose focus state to this process, so it receives a long
        autofocus settle period and the resulting file must pass the same strict
        quality gate. Failed quality causes another complete autofocus attempt.
        """
        command = [
            "rpicam-still",
            "-n",
            "-o", destination,
            "--width", str(self.capture_width),
            "--height", str(self.capture_height),
            "--quality", str(self.capture_quality),
            "-t", str(max(3000, int(self.focus_timeout_seconds * 1000))),
            "--autofocus-mode", "auto",
            "--awb", "auto",
            "--denoise", "cdn_off",
        ]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=self.focus_timeout_seconds + 15,
                check=False,
            )
        except FileNotFoundError as exc:
            return False, f"CAMERA_COMMAND_UNAVAILABLE:{exc}"
        except subprocess.TimeoutExpired:
            return False, "CAMERA_CAPTURE_TIMEOUT"

        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "rpicam-still failed").strip()
            return False, f"RPICAM_CAPTURE_ERROR:{detail[-500:]}"
        return True, ""

    def _validate_capture(self, path: str) -> Tuple[bool, str]:
        file_path = Path(path)
        if not file_path.is_file():
            return False, "CAPTURE_OUTPUT_UNAVAILABLE"
        size_bytes = file_path.stat().st_size
        if size_bytes < self.minimum_file_bytes:
            return False, f"CAPTURE_FILE_TOO_SMALL:{size_bytes}"

        image = cv2.imread(str(file_path), cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            return False, "CAPTURE_IMAGE_UNREADABLE"

        height, width = image.shape[:2]
        if width < int(self.capture_width * 0.90) or height < int(self.capture_height * 0.90):
            return False, f"CAPTURE_RESOLUTION_INVALID:{width}x{height}"

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = float(gray.mean())
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        self.last_quality = {
            "width": width,
            "height": height,
            "bytes": size_bytes,
            "brightness": round(brightness, 2),
            "sharpness": round(sharpness, 2),
            "minimum_sharpness": self.minimum_sharpness,
        }

        if brightness < self.minimum_brightness:
            return False, f"CAPTURE_TOO_DARK:{brightness:.2f}"
        if brightness > self.maximum_brightness:
            return False, f"CAPTURE_OVEREXPOSED:{brightness:.2f}"
        if sharpness < self.minimum_sharpness:
            return False, f"CAPTURE_NOT_SHARP:{sharpness:.2f}"
        return True, ""

    def capture_image(self, *, restart_preview: bool = True) -> bool:
        """Capture only after focus lock and return True only for a sharp file."""
        self._reset_result()
        was_previewing = self.is_previewing
        self.stop_preview()

        destination = self.capture_file
        final_reason = "CAPTURE_FAILED"

        for attempt in range(1, self.max_capture_attempts + 1):
            try:
                Path(destination).unlink(missing_ok=True)
            except OSError:
                pass

            captured, reason = self._capture_with_picamera2(destination)
            if not captured and reason == "PICAMERA2_UNAVAILABLE":
                captured, reason = self._capture_with_rpicam_still(destination)

            if captured:
                valid, validation_reason = self._validate_capture(destination)
                if valid:
                    log.info(
                        "Focused capture accepted attempt=%s/%s quality=%s",
                        attempt,
                        self.max_capture_attempts,
                        self.last_quality,
                    )
                    if was_previewing and restart_preview:
                        self.start_preview()
                    return True
                reason = validation_reason

            final_reason = reason or "CAPTURE_FAILED"
            log.warning(
                "Capture rejected attempt=%s/%s reason=%s focus=%s quality=%s",
                attempt,
                self.max_capture_attempts,
                final_reason,
                self.last_focus_state,
                self.last_quality,
            )
            time.sleep(0.5)

        try:
            Path(destination).unlink(missing_ok=True)
        except OSError:
            pass

        error_code = "AUTOFOCUS_FAILED" if (
            "FOCUS" in final_reason.upper() or "SHARP" in final_reason.upper()
        ) else "CAPTURE_QUALITY_FAILED"
        self._set_error(error_code, final_reason)

        if was_previewing and restart_preview:
            self.start_preview()
        return False

    def cleanup(self) -> None:
        self.stop_preview()
        self.clear_hardware()
