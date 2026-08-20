"""Manual, Pi-local Birth camera and Tesseract baseline diagnostic."""

from __future__ import annotations

import argparse
import os
import time

import cv2
import pytesseract


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture one fixed-focus Birth frame and run plain Tesseract.",
    )
    parser.add_argument(
        "--lens-position",
        type=float,
        default=float(os.getenv("BIRTH_CERTIFICATE_LENS_POSITION", "2.00")),
    )
    return parser.parse_args()


def main() -> int:
    from libcamera import controls
    from picamera2 import Picamera2

    args = parse_args()
    picam2 = Picamera2()
    config = picam2.create_still_configuration(
        main={"size": (1920, 1080), "format": "RGB888"},
    )
    picam2.configure(config)
    picam2.start()
    try:
        picam2.set_controls({
            "AfMode": controls.AfModeEnum.Manual,
            "LensPosition": float(args.lens_position),
        })
        time.sleep(0.8)
        frame = picam2.capture_array()
    finally:
        picam2.stop()

    gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
    text = pytesseract.image_to_string(binary, lang="eng")

    print(f"BIRTH_LENS_POSITION={args.lens_position:.2f}")
    print(f"BIRTH_TESSERACT_CHARACTER_COUNT={len(text.strip())}")
    print(f"BIRTH_TESSERACT_RAW={text!r}")
    if not text.strip():
        print("BIRTH_TESSERACT_BASELINE=FAILED")
        return 2
    print("BIRTH_TESSERACT_BASELINE=PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
