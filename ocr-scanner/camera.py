"""Reliable autofocus-gated Raspberry Pi camera capture."""
from __future__ import annotations
import json, os, signal, subprocess, time
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Tuple

class CameraController:
    def __init__(self):
        self.preview_process = None
        self.is_previewing = False
        self.capture_file = "/tmp/raw_capture.jpg"
        self.capture_width = int(os.getenv("CAMERA_CAPTURE_WIDTH", "2592"))
        self.capture_height = int(os.getenv("CAMERA_CAPTURE_HEIGHT", "1944"))
        self.capture_quality = int(os.getenv("CAMERA_CAPTURE_QUALITY", "95"))
        self.focus_timeout_ms = int(os.getenv("CAMERA_FOCUS_TIMEOUT_MS", "9000"))
        self.capture_attempts = max(1, int(os.getenv("CAMERA_CAPTURE_ATTEMPTS", "3")))
        self.minimum_jpeg_bytes = max(4096, int(os.getenv("CAMERA_MIN_JPEG_BYTES", "50000")))
        self.minimum_sharpness = float(os.getenv("CAMERA_MIN_SHARPNESS", "75.0"))

    @staticmethod
    def _run(args: Sequence[str], timeout: Optional[float] = None):
        return subprocess.run(list(args), capture_output=True, text=True, timeout=timeout, check=False)

    def clear_hardware(self):
        for name in ("rpicam-vid", "rpicam-still", "rpicam-hello"):
            subprocess.run(["sudo", "killall", "-9", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        time.sleep(0.5)

    def check_available(self):
        try:
            result = self._run(["rpicam-still", "--list-cameras"], 15)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
        output = f"{result.stdout}\n{result.stderr}"
        return result.returncode == 0 and "No cameras" not in output

    def start_preview(self):
        self.clear_hardware()
        try:
            self.preview_process = subprocess.Popen(
                ["rpicam-hello", "--timeout", "0", "--autofocus-mode", "continuous"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        except FileNotFoundError:
            return False
        time.sleep(2)
        self.is_previewing = self.preview_process.poll() is None
        return self.is_previewing

    def stop_preview(self):
        if self.preview_process and self.preview_process.poll() is None:
            try:
                os.killpg(os.getpgid(self.preview_process.pid), signal.SIGTERM)
                self.preview_process.wait(timeout=3)
            except Exception:
                try: os.killpg(os.getpgid(self.preview_process.pid), signal.SIGKILL)
                except Exception: pass
        self.preview_process = None
        self.is_previewing = False
        self.clear_hardware()

    @staticmethod
    def _read_metadata(path: str) -> Dict[str, Any]:
        try: text = Path(path).read_text(encoding="utf-8", errors="replace").strip()
        except OSError: return {}
        for candidate in [text] + list(reversed(text.splitlines())):
            try:
                value = json.loads(candidate)
                if isinstance(value, dict): return value
            except Exception: pass
        return {}

    @staticmethod
    def _focus_state(metadata: Dict[str, Any]) -> Optional[bool]:
        value = metadata.get("AfState", metadata.get("FocusState"))
        if value is None: return None
        value = str(value).strip().casefold()
        if value in {"focused", "success", "2"}: return True
        if value in {"failed", "failure", "3"}: return False
        return None

    @staticmethod
    def _jpeg_dimensions(path: str) -> Optional[Tuple[int, int]]:
        try:
            from PIL import Image
            with Image.open(path) as image: image.verify()
            with Image.open(path) as image: return image.width, image.height
        except Exception: return None

    @staticmethod
    def _sharpness(path: str) -> Optional[float]:
        try:
            import cv2
            image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if image is None: return None
            h, w = image.shape[:2]
            roi = image[int(h*.08):int(h*.92), int(w*.08):int(w*.92)]
            return float(cv2.Laplacian(roi if roi.size else image, cv2.CV_64F).var())
        except Exception: return None

    def _validate(self, image_path: str, metadata_path: str):
        try: size = os.path.getsize(image_path)
        except OSError: return False, "missing output"
        if size < self.minimum_jpeg_bytes: return False, "JPEG too small"
        dimensions = self._jpeg_dimensions(image_path)
        if not dimensions: return False, "invalid JPEG"
        if dimensions[0] < self.capture_width or dimensions[1] < self.capture_height:
            return False, "wrong dimensions"
        focus = self._focus_state(self._read_metadata(metadata_path))
        if focus is False: return False, "autofocus failed"
        sharpness = self._sharpness(image_path)
        if sharpness is not None and sharpness < self.minimum_sharpness:
            return False, f"blurred ({sharpness:.2f})"
        if focus is None and sharpness is None:
            return False, "focus unverifiable; install python3-opencv"
        return True, f"focused; sharpness={sharpness if sharpness is not None else 'metadata'}"

    def capture_image(self, *, restart_preview=True):
        was_previewing = self.is_previewing
        self.stop_preview()
        final = Path(self.capture_file)
        final.unlink(missing_ok=True)
        for attempt in range(1, self.capture_attempts + 1):
            image = Path(f"{self.capture_file}.attempt-{attempt}.jpg")
            metadata = Path(f"{self.capture_file}.attempt-{attempt}.json")
            image.unlink(missing_ok=True); metadata.unlink(missing_ok=True)
            cmd = ["rpicam-still", "--output", str(image), "--width", str(self.capture_width),
                   "--height", str(self.capture_height), "--quality", str(self.capture_quality),
                   "--timeout", str(self.focus_timeout_ms), "--autofocus-mode", "continuous",
                   "--autofocus-on-capture", "--awb", "auto", "--denoise", "cdn_off",
                   "--metadata", str(metadata), "--metadata-format", "json", "--nopreview"]
            print(f"[CAMERA] Waiting for focus; attempt {attempt}/{self.capture_attempts}")
            try: result = self._run(cmd, max(20, self.focus_timeout_ms/1000+15))
            except Exception as exc:
                print(f"[CAMERA] Capture error: {exc}"); result = None
            if result and result.returncode == 0 and image.exists():
                valid, reason = self._validate(str(image), str(metadata))
                print(f"[CAMERA] {reason}")
                if valid:
                    os.replace(image, final)
                    metadata.unlink(missing_ok=True)
                    print("[CAMERA] Focused capture accepted; submission may continue")
                    return True
            image.unlink(missing_ok=True); metadata.unlink(missing_ok=True)
            time.sleep(0.8)
        print("[CAMERA] No focused image; OCR/submission blocked")
        if was_previewing and restart_preview: self.start_preview()
        return False

    def cleanup(self):
        self.stop_preview()
        self.clear_hardware()
