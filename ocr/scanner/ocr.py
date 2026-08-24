"""
Fast bounded OCR preprocessing and extraction for Raspberry Pi.
"""

from __future__ import annotations

import os
import time
from typing import Optional

import cv2
import pytesseract
from pytesseract import Output


CAPTURE_FILE = "/tmp/raw_capture.jpg"
PROC_FILE = "/tmp/processed.jpg"

OCR_MAX_WIDTH = max(
    960,
    int(os.getenv("OCR_MAX_WIDTH", "1440")),
)
OCR_TIMEOUT_SECONDS = max(
    5.0,
    float(os.getenv("OCR_TIMEOUT_SECONDS", "25")),
)
OCR_SAVE_PROCESSED_DEBUG = (
    os.getenv(
        "OCR_SAVE_PROCESSED_DEBUG",
        "false",
    ).strip().lower()
    in {"1", "true", "yes", "on"}
)
LAST_OCR_CONFIDENCE: Optional[float] = None


def get_last_ocr_confidence() -> Optional[float]:
    return LAST_OCR_CONFIDENCE


def fast_preprocess(
    image_path: str,
    max_width: int = OCR_MAX_WIDTH,
):
    started_at = time.monotonic()

    image = cv2.imread(
        image_path,
        cv2.IMREAD_GRAYSCALE,
    )

    if image is None:
        return None

    height, width = image.shape[:2]

    if width > max_width:
        scale = max_width / float(width)
        image = cv2.resize(
            image,
            (
                max_width,
                max(1, int(height * scale)),
            ),
            interpolation=cv2.INTER_AREA,
        )

    _, thresholded = cv2.threshold(
        image,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    if OCR_SAVE_PROCESSED_DEBUG:
        cv2.imwrite(PROC_FILE, thresholded)

    print(
        "Prepared image in "
        f"{time.monotonic() - started_at:.2f}s "
        f"at width={thresholded.shape[1]}."
    )
    return thresholded


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
    global LAST_OCR_CONFIDENCE
    LAST_OCR_CONFIDENCE = None
    print("\nProcessing OCR...")

    try:
        processed = fast_preprocess(resolved_path)

        if processed is None:
            return ""

        kwargs = {
            "config": "--oem 3 --psm 6 -l eng",
        }

        try:
            data = pytesseract.image_to_data(
                processed,
                timeout=resolved_timeout,
                output_type=Output.DICT,
                **kwargs,
            )
        except TypeError:
            data = pytesseract.image_to_data(
                processed,
                output_type=Output.DICT,
                **kwargs,
            )

        words = []
        confidences = []
        for word, raw_confidence in zip(data.get("text", []), data.get("conf", [])):
            normalized = str(word or "").strip()
            try:
                confidence = float(raw_confidence)
            except (TypeError, ValueError):
                continue
            if not normalized or confidence < 0:
                continue
            words.append(normalized)
            confidences.append(confidence)
        text = " ".join(words)
        LAST_OCR_CONFIDENCE = (
            sum(confidences) / len(confidences)
            if confidences
            else None
        )

        elapsed = time.monotonic() - started_at

        if text and text.strip():
            clean_lines = []

            for line in text.split("\n"):
                normalized = line.strip()

                if normalized and any(
                    character.isalpha()
                    for character in normalized
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
        elapsed = time.monotonic()
        print(
            "OCR timed out after "
            f"{min(elapsed - started_at, resolved_timeout):.1f}s"
        )
        return ""
    except Exception as exc:
        print(f"OCR error: {exc}")
        return ""
