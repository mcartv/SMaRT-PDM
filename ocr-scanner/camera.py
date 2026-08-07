"""Autofocus-gated Raspberry Pi camera capture shared by every document type."""

from __future__ import annotations

import json
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Tuple


class CameraController:
    def __init__(self) -> None:
        self.preview_process: Optional[subprocess.Popen] = None
        self.is_previewing = False

        self.capture_file = "/tmp/raw_capture.jpg"
        self.capture_width = int(os.getenv("CAMERA_CAPTURE_WIDTH", "2592"))
        self.capture_height = int(os.getenv("CAMERA_CAPTURE_HEIGHT", "1944"))
        self.capture_quality = int(os.getenv("CAMERA_CAPTURE_QUALITY", "95"))

        self.focus_timeout_ms = max(
            5000,
            int(os.getenv("CAMERA_FOCUS_TIMEOUT_MS", "15000")),
        )
        self.capture_attempts = max(
            1,
            int(os.getenv("CAMERA_CAPTURE_ATTEMPTS", "3")),
        )
        self.minimum_jpeg_bytes = max(
            4096,
            int(os.getenv("CAMERA_MIN_JPEG_BYTES", "50000")),
        )
        self.minimum_sharpness = max(
            1.0,
            float(os.getenv("CAMERA_MIN_SHARPNESS", "70.0")),
        )

    @staticmethod
    def _run(
        args: Sequence[str],
        timeout: Optional[float] = None,
    ) -> subprocess.CompletedProcess:
        return subprocess.run(
            list(args),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )

    def clear_hardware(self) -> None:
        for name in ("rpicam-vid", "rpicam-still", "rpicam-hello"):
            subprocess.run(
                ["sudo", "killall", "-9", name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        time.sleep(0.25)

    def check_available(self) -> bool:
        try:
            result = self._run(["rpicam-still", "--list-cameras"], timeout=15)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

        output = f"{result.stdout}\n{result.stderr}"
        return result.returncode == 0 and "No cameras" not in output

    def start_preview(self) -> bool:
        self.clear_hardware()

        try:
            self.preview_process = subprocess.Popen(
                [
                    "rpicam-hello",
                    "--timeout",
                    "0",
                    "--autofocus-mode",
                    "continuous",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except FileNotFoundError:
            return False

        # Preview warm-up only. Capture still runs its own autofocus cycle.
        time.sleep(1.0)
        self.is_previewing = self.preview_process.poll() is None
        return self.is_previewing

    def stop_preview(self) -> None:
        process = self.preview_process

        if process is not None and process.poll() is None:
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

    @staticmethod
    def _read_metadata(path: str) -> Dict[str, Any]:
        try:
            text = Path(path).read_text(
                encoding="utf-8",
                errors="replace",
            ).strip()
        except OSError:
            return {}

        for candidate in [text, *reversed(text.splitlines())]:
            if not candidate:
                continue
            try:
                decoded = json.loads(candidate)
            except (TypeError, ValueError, json.JSONDecodeError):
                continue

            if isinstance(decoded, dict):
                return decoded

        return {}

    @classmethod
    def _find_focus_value(cls, value: Any) -> Any:
        if isinstance(value, dict):
            for key in ("AfState", "af_state", "FocusState", "focus_state"):
                if key in value:
                    return value[key]

            for nested in value.values():
                found = cls._find_focus_value(nested)
                if found is not None:
                    return found

        elif isinstance(value, list):
            for nested in reversed(value):
                found = cls._find_focus_value(nested)
                if found is not None:
                    return found

        return None

    @classmethod
    def _focus_state(cls, metadata: Dict[str, Any]) -> Optional[bool]:
        raw_value = cls._find_focus_value(metadata)
        if raw_value is None:
            return None

        normalized = str(raw_value).strip().casefold()

        # libcamera AfState: 2 = Focused, 3 = Failed.
        if normalized in {"focused", "success", "2"}:
            return True

        if normalized in {"failed", "failure", "3"}:
            return False

        # Idle / Scanning / unknown are not accepted.
        return None

    @staticmethod
    def _jpeg_dimensions(path: str) -> Optional[Tuple[int, int]]:
        try:
            from PIL import Image

            with Image.open(path) as image:
                image.verify()

            with Image.open(path) as image:
                return image.width, image.height

        except Exception:
            return None

    @staticmethod
    def _sharpness(path: str) -> Optional[float]:
        try:
            import cv2

            image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if image is None:
                return None

            height, width = image.shape[:2]
            roi = image[
                int(height * 0.08) : int(height * 0.92),
                int(width * 0.08) : int(width * 0.92),
            ]
            target = roi if roi.size else image

            return float(cv2.Laplacian(target, cv2.CV_64F).var())

        except Exception:
            return None

    def _validate_capture(
        self,
        image_path: str,
        metadata_path: str,
    ) -> Tuple[bool, str]:
        try:
            size = os.path.getsize(image_path)
        except OSError:
            return False, "output JPEG is missing"

        if size < self.minimum_jpeg_bytes:
            return False, (
                f"output JPEG is too small "
                f"({size} < {self.minimum_jpeg_bytes} bytes)"
            )

        dimensions = self._jpeg_dimensions(image_path)
        if dimensions is None:
            return False, "output JPEG is invalid"

        width, height = dimensions
        if width < self.capture_width or height < self.capture_height:
            return False, (
                f"output JPEG dimensions are too small "
                f"({width}x{height})"
            )

        focus = self._focus_state(self._read_metadata(metadata_path))

        if focus is False:
            return False, "autofocus failed"

        if focus is None:
            return False, (
                "autofocus did not reach Focused state; "
                "OCR/submission blocked"
            )

        sharpness = self._sharpness(image_path)
        if sharpness is None:
            return False, (
                "sharpness cannot be verified; install python3-opencv"
            )

        if sharpness < self.minimum_sharpness:
            return False, (
                f"image is blurred "
                f"({sharpness:.2f} < {self.minimum_sharpness:.2f})"
            )

        return True, f"verified focus; sharpness={sharpness:.2f}"

    def _capture_command(
        self,
        image: Path,
        metadata: Path,
    ) -> list[str]:
        return [
            "rpicam-still",
            "--output",
            str(image),
            "--width",
            str(self.capture_width),
            "--height",
            str(self.capture_height),
            "--quality",
            str(self.capture_quality),
            "--timeout",
            str(self.focus_timeout_ms),
            "--autofocus-mode",
            "auto",
            "--autofocus-on-capture",
            "--awb",
            "auto",
            "--denoise",
            "cdn_off",
            "--metadata",
            str(metadata),
            "--metadata-format",
            "json",
            "--nopreview",
        ]

    def capture_image(self, *, restart_preview: bool = True) -> bool:
        """
        Called after LEFT is pressed by capture_session.py.

        The same capture session is used before document-specific OCR dispatch,
        so this gate applies to Birth Certificate, Grade Form, and Certificate
        of Indigency.
        """
        was_previewing = self.is_previewing

        # Release preview ownership before still-camera autofocus.
        self.stop_preview()

        final = Path(self.capture_file)
        final.unlink(missing_ok=True)

        for attempt in range(1, self.capture_attempts + 1):
            image = Path(f"{self.capture_file}.attempt-{attempt}.jpg")
            metadata = Path(f"{self.capture_file}.attempt-{attempt}.json")

            image.unlink(missing_ok=True)
            metadata.unlink(missing_ok=True)

            print(
                "[CAMERA] LEFT pressed. Waiting for verified autofocus "
                f"before capture: attempt {attempt}/{self.capture_attempts}, "
                f"up to {self.focus_timeout_ms / 1000:.1f}s."
            )

            try:
                result = self._run(
                    self._capture_command(image, metadata),
                    timeout=max(
                        25.0,
                        self.focus_timeout_ms / 1000.0 + 15.0,
                    ),
                )
            except FileNotFoundError:
                print("[CAMERA] rpicam-still is not installed.")
                result = None
            except subprocess.TimeoutExpired:
                print("[CAMERA] autofocus/capture timed out.")
                result = None
            except Exception as exc:
                print(f"[CAMERA] capture error: {exc}")
                result = None

            if result is not None and result.returncode == 0:
                accepted, reason = self._validate_capture(
                    str(image),
                    str(metadata),
                )
                print(f"[CAMERA] {reason}")

                if accepted:
                    os.replace(image, final)
                    metadata.unlink(missing_ok=True)

                    print(
                        "[CAMERA] Focused capture accepted. "
                        "OCR/submission unlocked."
                    )
                    return True

            elif result is not None:
                error = (
                    result.stderr
                    or result.stdout
                    or "unknown rpicam-still error"
                ).strip()
                print(f"[CAMERA] rpicam-still failed: {error}")

            image.unlink(missing_ok=True)
            metadata.unlink(missing_ok=True)

            if attempt < self.capture_attempts:
                time.sleep(0.75)

        final.unlink(missing_ok=True)

        print(
            "[CAMERA] No verified focused image. "
            "OCR/submission blocked for all document types."
        )

        if was_previewing and restart_preview:
            self.start_preview()

        return False

    def cleanup(self) -> None:
        self.stop_preview()
        self.clear_hardware()
