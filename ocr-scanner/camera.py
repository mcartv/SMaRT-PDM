"""Robust Raspberry Pi Camera Module 3 document autofocus for SMaRT-PDM."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional, Sequence, Tuple


class CameraController:
    ANALYSIS_WIDTH = 1024

    def __init__(self) -> None:
        self.preview_process: Optional[subprocess.Popen] = None
        self.preview_overlay_process: Optional[subprocess.Popen] = None
        self.is_previewing = False
        self.capture_file = "/tmp/raw_capture.jpg"
        self.capture_width = int(os.getenv("CAMERA_CAPTURE_WIDTH", "2304"))
        self.capture_height = int(os.getenv("CAMERA_CAPTURE_HEIGHT", "1296"))
        self.capture_quality = max(
            85, min(100, int(os.getenv("CAMERA_CAPTURE_QUALITY", "95")))
        )
        self.capture_timeout_ms = max(
            350, int(os.getenv("CAMERA_FIXED_CAPTURE_TIMEOUT_MS", "650"))
        )
        self.minimum_jpeg_bytes = max(
            20000, int(os.getenv("CAMERA_MIN_JPEG_BYTES", "50000"))
        )
        self.minimum_focus_score = max(
            8.0, float(os.getenv("CAMERA_MIN_FOCUS_SCORE", "22.0"))
        )
        self.capture_status_enabled = (
            os.getenv("CAMERA_FOCUS_PREVIEW", "true").strip().lower()
            not in {"0", "false", "no", "off"}
        )
        self._capture_window_open = False

        # This installation is calibrated at one manual Camera Module 3 lens
        # position. Do not replace this with autofocus or a sweep.
        self.fixed_lens_position = 1.00
        self.capture_roi = self._parse_roi(
            os.getenv("CAMERA_CAPTURE_ROI", "0.08,0.08,0.84,0.84")
        )

    @staticmethod
    def _parse_roi(value: str) -> tuple[float, float, float, float]:
        try:
            x, y, width, height = (
                float(part.strip()) for part in value.split(",")
            )
        except (TypeError, ValueError):
            return (0.08, 0.08, 0.84, 0.84)
        if (
            x < 0
            or y < 0
            or width <= 0
            or height <= 0
            or x + width > 1
            or y + height > 1
        ):
            return (0.08, 0.08, 0.84, 0.84)
        return (x, y, width, height)

    def _roi_args(self) -> list[str]:
        return [
            "--roi",
            ",".join(f"{value:.4f}" for value in self.capture_roi),
        ]

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
        time.sleep(0.20)

    def check_available(self) -> bool:
        try:
            result = self._run(
                ["rpicam-still", "--list-cameras"],
                timeout=15,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
        output = f"{result.stdout}\n{result.stderr}".casefold()
        return result.returncode == 0 and "imx708" in output

    def start_preview(self) -> bool:
        self.clear_hardware()
        try:
            self.preview_process = subprocess.Popen(
                [
                    "rpicam-hello",
                    "--timeout", "0",
                    "--autofocus-mode", "continuous",
                    "--autofocus-range", "full",
                    *self._roi_args(),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except FileNotFoundError:
            return False
        time.sleep(1.0)
        self.is_previewing = self.preview_process.poll() is None
        if self.is_previewing:
            self._start_preview_instruction_overlay()
        return self.is_previewing

    def _start_preview_instruction_overlay(
        self,
        message: str = "READY TO CAPTURE?  PRESS THE LEFT BUTTON",
    ) -> None:
        self._stop_preview_instruction_overlay()
        if not self._ensure_gui_environment():
            return
        helper = Path(__file__).resolve().with_name("preview_instruction_overlay.py")
        if not helper.is_file():
            return
        try:
            self.preview_overlay_process = subprocess.Popen(
                [sys.executable, str(helper), message],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except (OSError, subprocess.SubprocessError):
            self.preview_overlay_process = None

    def show_processing_status(self) -> None:
        """Close live preview and immediately acknowledge the LEFT press."""
        self.stop_preview()
        self._start_preview_instruction_overlay(
            f"IMAGE PROCESSING - CAPTURING AT LENS {self.fixed_lens_position:.2f}"
        )

    def _stop_preview_instruction_overlay(self) -> None:
        process = self.preview_overlay_process
        if process is not None and process.poll() is None:
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                process.wait(timeout=1)
            except Exception:
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except Exception:
                    pass
        self.preview_overlay_process = None

    def stop_preview(self) -> None:
        self._stop_preview_instruction_overlay()
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
    def _jpeg_dimensions(
        path: str,
    ) -> Optional[Tuple[int, int]]:
        try:
            from PIL import Image
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                return image.width, image.height
        except Exception:
            return None

    @classmethod
    def _focus_score(cls, path: str) -> Optional[float]:
        try:
            import cv2
            import numpy as np

            image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if image is None or image.size == 0:
                return None

            height, width = image.shape[:2]
            roi = image[
                int(height * 0.08):int(height * 0.92),
                int(width * 0.08):int(width * 0.92),
            ]
            if roi.size == 0:
                roi = image

            rh, rw = roi.shape[:2]
            if rw <= 0 or rh <= 0:
                return None

            scale = cls.ANALYSIS_WIDTH / float(rw)
            target_height = max(1, int(round(rh * scale)))
            interpolation = (
                cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
            )
            normalized = cv2.resize(
                roi,
                (cls.ANALYSIS_WIDTH, target_height),
                interpolation=interpolation,
            )

            clahe = cv2.createCLAHE(
                clipLimit=2.0,
                tileGridSize=(8, 8),
            )
            normalized = clahe.apply(normalized)

            lap_score = float(
                cv2.Laplacian(
                    normalized,
                    cv2.CV_64F,
                    ksize=3,
                ).var()
            )

            gx = cv2.Sobel(
                normalized,
                cv2.CV_64F,
                1,
                0,
                ksize=3,
            )
            gy = cv2.Sobel(
                normalized,
                cv2.CV_64F,
                0,
                1,
                ksize=3,
            )
            tenengrad = float(np.mean(gx * gx + gy * gy))
            return lap_score + (tenengrad / 1000.0)
        except Exception:
            return None

    @classmethod
    def _sharpness(cls, path: str) -> Optional[float]:
        return cls._focus_score(path)

    def _common_capture_args(
        self,
        image: Path,
        width: int,
        height: int,
        timeout_ms: int,
    ) -> list[str]:
        return [
            "rpicam-still",
            "--output", str(image),
            "--width", str(width),
            "--height", str(height),
            "--quality", str(self.capture_quality),
            "--timeout", str(timeout_ms),
            "--awb", "auto",
            "--nopreview",
            *self._roi_args(),
        ]

    def _manual_command(
        self,
        image: Path,
        lens_position: float,
        *,
        width: int,
        height: int,
        timeout_ms: int,
    ) -> list[str]:
        return self._common_capture_args(
            image,
            width,
            height,
            timeout_ms,
        ) + [
            "--autofocus-mode", "manual",
            "--lens-position", f"{lens_position:.4f}",
        ]

    def _valid_jpeg(
        self,
        path: Path,
        *,
        min_width: int,
        min_height: int,
    ) -> bool:
        try:
            if path.stat().st_size < self.minimum_jpeg_bytes:
                return False
        except OSError:
            return False

        dimensions = self._jpeg_dimensions(str(path))
        if dimensions is None:
            return False

        width, height = dimensions
        return width >= min_width and height >= min_height

    def _ensure_gui_environment(self) -> bool:
        if os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
            return True
        try:
            uid = os.getuid()
            for entry in Path("/proc").iterdir():
                if not entry.name.isdigit():
                    continue
                try:
                    if entry.stat().st_uid != uid:
                        continue
                    raw = (entry / "environ").read_bytes()
                except OSError:
                    continue
                env = {}
                for item in raw.split(b"\0"):
                    if b"=" not in item:
                        continue
                    key, value = item.split(b"=", 1)
                    env[key.decode(errors="ignore")] = value.decode(errors="ignore")
                if not (env.get("DISPLAY") or env.get("WAYLAND_DISPLAY")):
                    continue
                for key in ("DISPLAY", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "XAUTHORITY"):
                    if env.get(key):
                        os.environ[key] = env[key]
                return True
        except Exception:
            return False
        return False

    def _show_capture_frame(self, image: Path, lines: list[str], *, wait_ms: int = 550) -> None:
        if not self.capture_status_enabled or not self._ensure_gui_environment():
            return
        try:
            import cv2
            frame = cv2.imread(str(image))
            if frame is None:
                return
            window = "SMaRT-PDM Capture"
            cv2.namedWindow(window, cv2.WINDOW_NORMAL)
            cv2.setWindowProperty(window, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
            height, width = frame.shape[:2]
            target_width = min(1600, width)
            scale = target_width / float(width)
            shown = cv2.resize(frame, (target_width, max(1, int(height * scale))), interpolation=cv2.INTER_AREA)
            cv2.rectangle(shown, (20, 20), (shown.shape[1] - 20, 185), (0, 0, 0), -1)
            y = 55
            for line in lines:
                cv2.putText(shown, line, (45, y), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (255, 255, 255), 2, cv2.LINE_AA)
                y += 38
            cv2.imshow(window, shown)
            cv2.waitKey(wait_ms)
            self._capture_window_open = True
        except Exception as exc:
            print(f"[CAMERA] Capture status unavailable: {exc}")
            self.capture_status_enabled = False

    def _close_capture_status(self) -> None:
        if not self._capture_window_open:
            return
        try:
            import cv2
            cv2.destroyWindow("SMaRT-PDM Capture")
            cv2.waitKey(1)
        except Exception:
            pass
        self._capture_window_open = False

    def _sample_position(
        self,
        position: float,
        *,
        width: int,
        height: int,
        timeout_ms: int,
        suffix: str,
    ) -> Optional[Tuple[float, Path]]:
        image = Path(
            f"{self.capture_file}.{suffix}-{position:.4f}.jpg"
        )
        image.unlink(missing_ok=True)

        try:
            result = self._run(
                self._manual_command(
                    image,
                    position,
                    width=width,
                    height=height,
                    timeout_ms=timeout_ms,
                ),
                timeout=max(
                    15.0,
                    timeout_ms / 1000.0 + 8.0,
                ),
            )
        except Exception:
            image.unlink(missing_ok=True)
            return None

        if result.returncode != 0:
            image.unlink(missing_ok=True)
            return None

        if self._jpeg_dimensions(str(image)) is None:
            image.unlink(missing_ok=True)
            return None

        score = self._focus_score(str(image))
        if score is None:
            image.unlink(missing_ok=True)
            return None

        return score, image

    def capture_image(
        self,
        *,
        restart_preview: bool = True,
        status_callback=None,
    ) -> bool:
        was_previewing = self.is_previewing
        if self.is_previewing:
            self.stop_preview()

        final = Path(self.capture_file)
        final.unlink(missing_ok=True)

        if status_callback:
            status_callback('capturing')

        position = self.fixed_lens_position
        sampled = self._sample_position(
            position,
            width=self.capture_width,
            height=self.capture_height,
            timeout_ms=self.capture_timeout_ms,
            suffix="fixed",
        )
        if sampled is not None:
            score, image = sampled
            if self._valid_jpeg(
                image,
                min_width=self.capture_width,
                min_height=self.capture_height,
            ):
                self._stop_preview_instruction_overlay()
                os.replace(image, final)
                self._show_capture_frame(
                    final,
                    [
                        "IMAGE CAPTURED",
                        f"Fixed lens position: {position:.2f}",
                        f"Sharpness score: {score:.2f}",
                        "IMAGE PROCESSING - STARTING TESSERACT OCR",
                    ],
                    wait_ms=450,
                )
                self._close_capture_status()
                print(
                    "[CAMERA] Fixed-lens capture accepted. "
                    f"Lens={position:.3f}; "
                    f"normalized score={score:.2f}. "
                    "OCR/submission unlocked."
                )
                return True
            image.unlink(missing_ok=True)

        final.unlink(missing_ok=True)
        self._close_capture_status()

        print(
            "[CAMERA] No verified fixed-lens capture. "
            "OCR/submission blocked."
        )

        if was_previewing and restart_preview:
            self.start_preview()

        return False

    def cleanup(self) -> None:
        self.stop_preview()
        self.clear_hardware()
