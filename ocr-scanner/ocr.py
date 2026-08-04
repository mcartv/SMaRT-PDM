"""
ocr.py - Bounded fast OCR extraction for Raspberry Pi.
"""

from __future__ import annotations

import os
import time
from typing import Optional

import cv2
import pytesseract

CAPTURE_FILE = "/tmp/raw_capture.jpg"
PROC_FILE = "/tmp/processed.jpg"

OCR_MAX_WIDTH = max(960, int(os.getenv("OCR_MAX_WIDTH", "1600")))
OCR_TIMEOUT_SECONDS = max(5.0, float(os.getenv("OCR_TIMEOUT_SECONDS", "25")))


def fast_preprocess(image_path: str, max_width: int = OCR_MAX_WIDTH):
    img = cv2.imread(image_path)
    if img is None:
        return None

    height, width = img.shape[:2]
    if width > max_width:
        scale = max_width / float(width)
        img = cv2.resize(
            img,
            (max_width, max(1, int(height * scale))),
            interpolation=cv2.INTER_AREA,
        )

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    return thresh


def extract_text(
    image_path: Optional[str] = None,
    *,
    timeout_seconds: Optional[float] = None,
) -> str:
    resolved_path = image_path or CAPTURE_FILE

    if not os.path.exists(resolved_path):
        print("Image not found")
        return ""

    started_at = time.monotonic()
    resolved_timeout = max(
        5.0,
        float(
            OCR_TIMEOUT_SECONDS
            if timeout_seconds is None
            else timeout_seconds
        ),
    )
    print("\nProcessing OCR...")

    try:
        processed = fast_preprocess(resolved_path)
        if processed is None:
            return ""

        cv2.imwrite(PROC_FILE, processed)

        kwargs = {
            "config": "--oem 3 --psm 6 -l eng",
        }
        try:
            text = pytesseract.image_to_string(
                processed,
                timeout=resolved_timeout,
                **kwargs,
            )
        except TypeError:
            text = pytesseract.image_to_string(processed, **kwargs)

        elapsed = time.monotonic() - started_at

        if text and text.strip():
            clean_lines = []
            for line in text.split("\n"):
                normalized = line.strip()
                if normalized and any(
                    character.isalpha() for character in normalized
                ):
                    clean_lines.append(normalized)

            clean_text = "\n".join(clean_lines)

            if clean_text:
                print(
                    f"Extracted {len(clean_text.split())} words "
                    f"in {elapsed:.1f}s"
                )
                return clean_text

        print(f"No text found (took {elapsed:.1f}s)")
        return ""

    except RuntimeError:
        elapsed = time.monotonic() - started_at
        print(
            "OCR timed out after "
            f"{min(elapsed, resolved_timeout):.1f}s"
        )
        return ""
    except Exception as exc:
        print(f"OCR error: {exc}")
        return ""
