"""Robust Raspberry Pi Camera Module 3 document autofocus for SMaRT-PDM."""

from __future__ import annotations

import json
import math
import os
import signal
import subprocess
import time
from pathlib import Path
from statistics import median
from typing import Any, Dict, Iterable, Optional, Sequence, Tuple


class CameraController:
    ANALYSIS_WIDTH = 1024

    def __init__(self) -> None:
        self.preview_process: Optional[subprocess.Popen] = None
        self.is_previewing = False
        self.capture_file = "/tmp/raw_capture.jpg"
        self.capture_width = int(os.getenv("CAMERA_CAPTURE_WIDTH", "2304"))
        self.capture_height = int(os.getenv("CAMERA_CAPTURE_HEIGHT", "1296"))
        self.capture_quality = max(
            85, min(100, int(os.getenv("CAMERA_CAPTURE_QUALITY", "95")))
        )
        self.focus_timeout_ms = max(
            8000, int(os.getenv("CAMERA_FOCUS_TIMEOUT_MS", "12000"))
        )
        self.native_af_attempts = max(
            1, int(os.getenv("CAMERA_NATIVE_AF_ATTEMPTS", "2"))
        )
        self.capture_attempts = self.native_af_attempts
        self.minimum_jpeg_bytes = max(
            20000, int(os.getenv("CAMERA_MIN_JPEG_BYTES", "50000"))
        )
        self.minimum_focus_score = max(
            8.0, float(os.getenv("CAMERA_MIN_FOCUS_SCORE", "22.0"))
        )
        # SMARTPDM_VISIBLE_FOCUS_SWEEP_V37
        self.focus_preview_enabled = (
            os.getenv("CAMERA_FOCUS_PREVIEW", "true").strip().lower()
            not in {"0", "false", "no", "off"}
        )
        self._focus_window_open = False

        positions = os.getenv(
            "CAMERA_FOCUS_SWEEP_POSITIONS",
            "0.5,1.0,1.5,1.75,2.0,2.25,2.5,2.75,3.0,"
            "3.5,4.0,5.0,6.0,7.5,9.0,11.0,13.0",
        )
        parsed = []
        for raw in positions.split(","):
            try:
                value = float(raw.strip())
            except ValueError:
                continue
            if 0.0 <= value <= 20.0:
                parsed.append(value)

        self.focus_sweep_positions = sorted(set(parsed)) or [
            0.5, 1.0, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75,
            3.0, 3.5, 4.0, 5.0, 6.0, 7.5, 9.0, 11.0, 13.0,
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
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except FileNotFoundError:
            return False
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
                encoding="utf-8", errors="replace"
            ).strip()
        except OSError:
            return {}
        if not text:
            return {}
        for candidate in [text, *reversed(text.splitlines())]:
            try:
                value = json.loads(candidate)
            except Exception:
                continue
            if isinstance(value, dict):
                return value
        return {}

    @classmethod
    def _find_key(cls, value: Any, names: Iterable[str]) -> Any:
        lowered = {str(name).casefold() for name in names}
        if isinstance(value, dict):
            for key, item in value.items():
                if str(key).casefold() in lowered:
                    return item
            for item in value.values():
                found = cls._find_key(item, lowered)
                if found is not None:
                    return found
        elif isinstance(value, list):
            for item in reversed(value):
                found = cls._find_key(item, lowered)
                if found is not None:
                    return found
        return None

    @classmethod
    def _focus_state(
        cls, metadata: Dict[str, Any]
    ) -> Optional[bool]:
        raw = cls._find_key(
            metadata,
            ("AfState", "FocusState", "af_state", "focus_state"),
        )
        if raw is None:
            return None
        normalized = str(raw).strip().casefold()
        if normalized in {"focused", "success", "2"}:
            return True
        if normalized in {"failed", "failure", "3"}:
            return False
        return None

    @classmethod
    def _metadata_lens_position(
        cls, metadata: Dict[str, Any]
    ) -> Optional[float]:
        raw = cls._find_key(
            metadata,
            ("LensPosition", "lens_position"),
        )
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return None
        return value if math.isfinite(value) else None

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
        ]

    def _native_command(
        self,
        image: Path,
        metadata: Path,
    ) -> list[str]:
        return self._common_capture_args(
            image,
            self.capture_width,
            self.capture_height,
            self.focus_timeout_ms,
        ) + [
            "--autofocus-mode", "auto",
            "--autofocus-on-capture",
            "--autofocus-range", "full",
            "--autofocus-speed", "normal",
            "--metadata", str(metadata),
            "--metadata-format", "json",
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

    def _capture_command(
        self,
        image: Path,
        metadata: Path,
    ) -> list[str]:
        return self._native_command(image, metadata)

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

    def _try_native_autofocus(self) -> Optional[Path]:
        for attempt in range(1, self.native_af_attempts + 1):
            image = Path(
                f"{self.capture_file}.native-{attempt}.jpg"
            )
            metadata = Path(
                f"{self.capture_file}.native-{attempt}.json"
            )
            image.unlink(missing_ok=True)
            metadata.unlink(missing_ok=True)

            print(
                "[CAMERA] Native autofocus "
                f"{attempt}/{self.native_af_attempts}"
            )

            try:
                result = self._run(
                    self._native_command(image, metadata),
                    timeout=max(
                        30.0,
                        self.focus_timeout_ms / 1000.0 + 15.0,
                    ),
                )
            except Exception as exc:
                print(f"[CAMERA] Native AF command error: {exc}")
                continue

            if result.returncode != 0:
                image.unlink(missing_ok=True)
                metadata.unlink(missing_ok=True)
                continue

            if not self._valid_jpeg(
                image,
                min_width=self.capture_width,
                min_height=self.capture_height,
            ):
                image.unlink(missing_ok=True)
                metadata.unlink(missing_ok=True)
                continue

            metadata_value = self._read_metadata(str(metadata))
            state = self._focus_state(metadata_value)
            lens = self._metadata_lens_position(metadata_value)
            score = self._focus_score(str(image))

            print(
                "[CAMERA] Native AF "
                f"state={state}; lens={lens}; score={score}"
            )

            if (
                state is True
                and score is not None
                and score >= self.minimum_focus_score
            ):
                metadata.unlink(missing_ok=True)
                return image

            image.unlink(missing_ok=True)
            metadata.unlink(missing_ok=True)

        return None

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

    def _show_focus_frame(self, image: Path, lines: list[str], *, wait_ms: int = 550) -> None:
        if not self.focus_preview_enabled or not self._ensure_gui_environment():
            return
        try:
            import cv2
            frame = cv2.imread(str(image))
            if frame is None:
                return
            window = "SMaRT-PDM Auto Focus"
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
            self._focus_window_open = True
        except Exception as exc:
            print(f"[CAMERA] Focus preview unavailable: {exc}")
            self.focus_preview_enabled = False

    def _close_focus_preview(self) -> None:
        if not self._focus_window_open:
            return
        try:
            import cv2
            cv2.destroyWindow("SMaRT-PDM Auto Focus")
            cv2.waitKey(1)
        except Exception:
            pass
        self._focus_window_open = False

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

    def _coarse_sweep(
        self,
    ) -> Optional[Tuple[float, float, list[Tuple[float, float]]]]:
        observations: list[Tuple[float, float]] = []

        print(
            "[CAMERA] Native AF did not lock. "
            "Starting normalized physical lens sweep."
        )

        for position in self.focus_sweep_positions:
            sampled = self._sample_position(
                position,
                width=1536,
                height=864,
                timeout_ms=1100,
                suffix="coarse",
            )

            if sampled is None:
                print(
                    f"[CAMERA] Lens {position:.3f}: unavailable"
                )
                continue

            score, image = sampled
            observations.append((position, score))
            current_best = max(value for _, value in observations)
            self._show_focus_frame(
                image,
                [
                    "FOCUSING - COARSE SWEEP",
                    f"Lens position: {position:.2f}",
                    f"Focus score: {score:.2f}",
                    f"Best score: {current_best:.2f}",
                ],
            )
            image.unlink(missing_ok=True)

            print(
                f"[CAMERA] Lens {position:.3f}: "
                f"normalized score={score:.2f}"
            )

        if len(observations) < 3:
            return None

        observations.sort(key=lambda item: item[1], reverse=True)
        best_position, best_score = observations[0]
        values = [score for _, score in observations]
        background = median(values)

        print(
            "[CAMERA] Coarse best="
            f"{best_position:.3f}; score={best_score:.2f}; "
            f"median={background:.2f}"
        )

        if best_score < self.minimum_focus_score:
            return None

        if background > 0 and best_score / background < 1.20:
            return None

        return best_position, best_score, observations

    def _refine_position(
        self,
        coarse_position: float,
        coarse_score: float,
    ) -> Tuple[float, float]:
        positions = []
        for step in range(-6, 7):
            value = max(
                0.0,
                min(20.0, coarse_position + (step * 0.10)),
            )
            if value not in positions:
                positions.append(value)

        best_position = coarse_position
        best_score = coarse_score

        print(
            "[CAMERA] Refining focus around "
            f"{coarse_position:.3f}"
        )

        for position in positions:
            sampled = self._sample_position(
                position,
                width=1536,
                height=864,
                timeout_ms=1000,
                suffix="refine",
            )

            if sampled is None:
                continue

            score, image = sampled
            self._show_focus_frame(
                image,
                [
                    "FOCUSING - FINE SWEEP",
                    f"Lens position: {position:.2f}",
                    f"Focus score: {score:.2f}",
                    f"Best score: {max(best_score, score):.2f}",
                ],
            )
            image.unlink(missing_ok=True)

            print(
                f"[CAMERA] Refine {position:.3f}: "
                f"normalized score={score:.2f}"
            )

            if score > best_score:
                best_position = position
                best_score = score

        return best_position, best_score

    def _final_candidates(
        self,
        best_position: float,
        reference_score: float,
    ) -> Optional[Tuple[Path, float, float]]:
        positions = []
        for delta in (
            -0.30, -0.20, -0.10,
            0.0,
            0.10, 0.20, 0.30,
        ):
            value = max(
                0.0,
                min(20.0, best_position + delta),
            )
            if value not in positions:
                positions.append(value)

        winner_path: Optional[Path] = None
        winner_position = best_position
        winner_score = -1.0

        for position in positions:
            for frame in range(1, 3):
                sampled = self._sample_position(
                    position,
                    width=self.capture_width,
                    height=self.capture_height,
                    timeout_ms=1600,
                    suffix=f"final-{frame}",
                )

                if sampled is None:
                    continue

                score, image = sampled

                if not self._valid_jpeg(
                    image,
                    min_width=self.capture_width,
                    min_height=self.capture_height,
                ):
                    image.unlink(missing_ok=True)
                    continue

                self._show_focus_frame(
                    image,
                    [
                        "CAPTURING FINAL FOCUS",
                        f"Lens position: {position:.2f}",
                        f"Focus score: {score:.2f}",
                        f"Best score: {max(winner_score, score):.2f}",
                    ],
                    wait_ms=400,
                )

                print(
                    f"[CAMERA] Final lens {position:.3f} "
                    f"frame {frame}: normalized score={score:.2f}"
                )

                if score > winner_score:
                    if winner_path is not None:
                        winner_path.unlink(missing_ok=True)
                    winner_path = image
                    winner_position = position
                    winner_score = score
                else:
                    image.unlink(missing_ok=True)

        if winner_path is None:
            return None

        required_score = max(
            self.minimum_focus_score,
            reference_score * 0.55,
        )

        print(
            "[CAMERA] Best final lens="
            f"{winner_position:.3f}; score={winner_score:.2f}; "
            f"required={required_score:.2f}"
        )

        if winner_score < required_score:
            winner_path.unlink(missing_ok=True)
            return None

        return winner_path, winner_position, winner_score

    def capture_image(
        self,
        *,
        restart_preview: bool = True,
        status_callback=None,
    ) -> bool:
        was_previewing = self.is_previewing
        self.stop_preview()

        final = Path(self.capture_file)
        final.unlink(missing_ok=True)

        # Preview #2: always show the real physical focus search.
        coarse = self._coarse_sweep()

        if coarse is not None:
            coarse_position, coarse_score, _ = coarse
            refined_position, refined_score = self._refine_position(
                coarse_position,
                coarse_score,
            )

            print(
                "[CAMERA] Refined best lens="
                f"{refined_position:.3f}; "
                f"score={refined_score:.2f}"
            )

            if status_callback:
                status_callback('capturing')

            selected = self._final_candidates(
                refined_position,
                refined_score,
            )

            if selected is not None:
                winner, position, score = selected
                os.replace(winner, final)

                self._show_focus_frame(
                    final,
                    [
                        "AUTOFOCUS COMPLETE",
                        f"Selected lens: {position:.2f}",
                        f"Final focus score: {score:.2f}",
                        "Starting OCR...",
                    ],
                    wait_ms=1800,
                )
                self._close_focus_preview()

                print(
                    "[CAMERA] Software autofocus verified. "
                    f"Lens={position:.3f}; "
                    f"normalized score={score:.2f}. "
                    "OCR/submission unlocked."
                )
                return True

        # Fallback to native autofocus only if the visible sweep fails.
        native = self._try_native_autofocus()
        if native is not None:
            os.replace(native, final)
            self._close_focus_preview()
            return True

        final.unlink(missing_ok=True)
        self._close_focus_preview()

        print(
            "[CAMERA] No verified focused capture. "
            "OCR/submission blocked."
        )

        if was_previewing and restart_preview:
            self.start_preview()

        return False

    def cleanup(self) -> None:
        self.stop_preview()
        self.clear_hardware()
