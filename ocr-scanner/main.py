#!/usr/bin/env python3
"""
main.py - Interactive Pi OCR capture entrypoint.

Worker contract:
- LEFT in preview  -> capture + OCR
- RIGHT in preview -> cancel (exit 2)
- LEFT in result   -> save/confirm (exit 0)
- RIGHT in result  -> discard/cancel (exit 2)

Output files:
- /tmp/ocr_raw.txt
- /tmp/ocr_result.txt
"""

import argparse
import fcntl
import os
import signal
import struct
import sys
import time
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

from camera import CameraController
from ocr import extract_text
from spell_check import correct_ocr_text

load_dotenv()

INPUT_DEVICE = os.getenv("INPUT_DEVICE", "/dev/input/event4")
DEBOUNCE_MS = int(os.getenv("DEBOUNCE_MS", "500"))
QUEUE_MODE = os.getenv("QUEUE_MODE", "1")

TMP_RAW = "/tmp/ocr_raw.txt"
TMP_RESULT = "/tmp/ocr_result.txt"

LEFT_CODE = 272
RIGHT_CODE = 273


@dataclass
class RequestMeta:
    application_id: str = ""
    student_id: str = ""
    student_name: str = ""
    document_key: str = ""
    document_type: str = ""


def clear_tmp_outputs() -> None:
    for path in (TMP_RAW, TMP_RESULT):
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write("")
        except Exception as exc:
            print(f"[SCAN] Failed clearing {path}: {exc}")


def write_tmp_outputs(raw_text: str, corrected_text: str) -> None:
    with open(TMP_RAW, "w", encoding="utf-8") as f:
        f.write(raw_text or "")
    with open(TMP_RESULT, "w", encoding="utf-8") as f:
        f.write(corrected_text or "")


class ButtonReader:
    def __init__(self, device_path: str = INPUT_DEVICE):
        self.device_path = device_path
        self.device_file = None
        self.last_left_ms = 0.0
        self.last_right_ms = 0.0

    def start(self) -> None:
        os.system(f"sudo chmod 666 {self.device_path} 2>/dev/null")
        self.device_file = open(self.device_path, "rb")
        flags = fcntl.fcntl(self.device_file.fileno(), fcntl.F_GETFL)
        fcntl.fcntl(self.device_file.fileno(), fcntl.F_SETFL, flags | os.O_NONBLOCK)

    def stop(self) -> None:
        if self.device_file:
            try:
                self.device_file.close()
            except Exception:
                pass
            self.device_file = None

    def poll_press(self) -> Optional[str]:
        if not self.device_file:
            return None

        try:
            data = self.device_file.read(24)
            if not data or len(data) != 24:
                return None

            _, _, ev_type, ev_code, ev_value = struct.unpack("llHHI", data)
            if ev_type != 1 or ev_value != 0:
                return None

            now_ms = time.time() * 1000.0

            if ev_code == LEFT_CODE:
                if now_ms - self.last_left_ms > DEBOUNCE_MS:
                    self.last_left_ms = now_ms
                    return "left"
                return None

            if ev_code == RIGHT_CODE:
                if now_ms - self.last_right_ms > DEBOUNCE_MS:
                    self.last_right_ms = now_ms
                    return "right"
                return None

            return None
        except BlockingIOError:
            return None
        except Exception:
            return None

    def wait_for_press(self, prompt: str) -> str:
        print(prompt)
        while True:
            pressed = self.poll_press()
            if pressed:
                return pressed
            time.sleep(0.01)


def print_header(meta: RequestMeta) -> None:
    print("[SCAN] SMaRT-PDM Pi IoT OCR")
    print(f"[SCAN] Request: {meta.document_key or 'document'} | {meta.student_name or 'Unknown'}")
    if meta.application_id:
        print(f"[SCAN] Application: {meta.application_id}")


def print_text_preview(text: str, max_lines: int = 6) -> None:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        print("[SCAN] Extracted Text: (empty)")
        return

    print(f"[SCAN] Extracted Text (first {min(max_lines, len(lines))} lines):")
    for idx, line in enumerate(lines[:max_lines], start=1):
        print(f"  {idx}) {line}")


def run_single_interactive_scan(meta: RequestMeta) -> int:
    clear_tmp_outputs()
    print_header(meta)

    camera = CameraController()
    buttons = ButtonReader()

    def cleanup() -> None:
        try:
            camera.stop_preview()
        except Exception:
            pass
        try:
            if hasattr(camera, "cleanup"):
                camera.cleanup()
        except Exception:
            pass
        buttons.stop()

    def handle_sig(_sig, _frame):
        cleanup()
        sys.exit(2)

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    try:
        if not camera.check_available():
            print("[SCAN] Camera unavailable")
            return 1

        buttons.start()

        if not camera.start_preview():
            print("[SCAN] Failed to start camera preview")
            return 1

        first = buttons.wait_for_press("[SCAN] Controls: LEFT=Capture OCR, RIGHT=Cancel")
        if first == "right":
            print("[SCAN] Cancelled by user")
            return 2

        print("[SCAN] Capturing image...")
        if not camera.capture_image():
            print("[SCAN] Capture failed")
            return 1

        # Ensure preview is off before OCR processing
        camera.stop_preview()

        image_path = "/tmp/raw_capture.jpg"
        raw_text = (extract_text(image_path) or "").strip()

        if not raw_text:
            print("[SCAN] OCR failed: empty extracted text")
            return 1

        corrected_text = (correct_ocr_text(raw_text, aggressive=False) or raw_text).strip() or raw_text
        write_tmp_outputs(raw_text, corrected_text)

        print(f"[SCAN] OCR complete (raw={len(raw_text)} chars, corrected={len(corrected_text)} chars)")
        print_text_preview(corrected_text, max_lines=6)

        second = buttons.wait_for_press("[SCAN] Controls: LEFT=Confirm Save, RIGHT=Discard")
        if second == "right":
            clear_tmp_outputs()
            print("[SCAN] Discarded OCR result")
            return 2

        print("[SCAN] Saved to /tmp/ocr_raw.txt and /tmp/ocr_result.txt")
        return 0
    finally:
        cleanup()


def parse_args() -> RequestMeta:
    parser = argparse.ArgumentParser(description="Pi IoT OCR interactive runner")
    parser.add_argument("--application-id", default="")
    parser.add_argument("--student-id", default="")
    parser.add_argument("--student-name", default="")
    parser.add_argument("--document-key", default="")
    parser.add_argument("--document-type", default="")
    args = parser.parse_args()

    return RequestMeta(
        application_id=args.application_id,
        student_id=args.student_id,
        student_name=args.student_name,
        document_key=args.document_key,
        document_type=args.document_type,
    )


def main() -> None:
    meta = parse_args()
    code = run_single_interactive_scan(meta)

    # Queue mode required by worker status mapping.
    if QUEUE_MODE == "1":
        sys.exit(code)

    sys.exit(code)


if __name__ == "__main__":
    main()
