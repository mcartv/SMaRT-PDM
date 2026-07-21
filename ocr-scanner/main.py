#!/usr/bin/env python3
"""
main.py - Interactive Pi OCR capture entrypoint.

Interaction contract:
- LEFT in preview  -> capture + OCR
- RIGHT in preview -> cancel (exit 2)
- OCR output is saved immediately for administrative review

Output files:
- /tmp/ocr_raw.txt
- /tmp/ocr_result.txt
"""

import argparse
import signal
import sys
import threading
from dataclasses import dataclass

from dotenv import load_dotenv

from capture_session import CANCELLED, CAPTURED, run_capture_session
from ocr import extract_text
from spell_check import correct_ocr_text

load_dotenv()

TMP_RAW = "/tmp/ocr_raw.txt"
TMP_RESULT = "/tmp/ocr_result.txt"


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


def print_header(meta: RequestMeta) -> None:
    print("[SCAN] SMaRT-PDM Pi IoT OCR")
    print(f"[SCAN] Document: {meta.document_key or 'document'}")


def run_single_interactive_scan(meta: RequestMeta) -> int:
    clear_tmp_outputs()
    print_header(meta)

    stop_requested = threading.Event()

    def handle_sig(_sig, _frame):
        stop_requested.set()

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    capture_result = run_capture_session(should_stop=stop_requested.is_set)
    if capture_result.status == CANCELLED:
        print("[SCAN] Cancelled before capture")
        return 2
    if capture_result.status != CAPTURED:
        print(f"[SCAN] Capture failed ({capture_result.error_code})")
        return 1

    try:
        raw_text = (extract_text(capture_result.capture_path) or "").strip()
    except Exception:
        raw_text = ""
    if not raw_text:
        print("[SCAN] OCR failed: empty output")
        return 1

    corrected_text = (
        (correct_ocr_text(raw_text, aggressive=False) or raw_text).strip()
        or raw_text
    )
    write_tmp_outputs(raw_text, corrected_text)
    print(
        f"[SCAN] OCR complete (raw_chars={len(raw_text)}, "
        f"corrected_chars={len(corrected_text)})"
    )
    return 0


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

    sys.exit(code)


if __name__ == "__main__":
    main()
