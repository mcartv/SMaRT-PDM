"""
ocr.py - Fast OCR extraction
"""

import cv2
import os
import time
import pytesseract

CAPTURE_FILE = "/tmp/raw_capture.jpg"
PROC_FILE = "/tmp/processed.jpg"


def fast_preprocess(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None

    height, width = img.shape[:2]
    if width > 1920:
        scale = 1920 / width
        img = cv2.resize(img, (1920, int(height * scale)))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def extract_text(image_path=None):
    if image_path is None:
        image_path = CAPTURE_FILE

    if not os.path.exists(image_path):
        print("Image not found")
        return ""

    start_time = time.time()
    print("\nProcessing OCR...")

    try:
        processed = fast_preprocess(image_path)
        if processed is None:
            return ""

        cv2.imwrite(PROC_FILE, processed)
        text = pytesseract.image_to_string(processed, config="--oem 3 --psm 6 -l eng")

        elapsed = time.time() - start_time

        if text and text.strip():
            lines = text.split("\n")
            clean_lines = []
            for line in lines:
                line = line.strip()
                if line and any(c.isalpha() for c in line):
                    clean_lines.append(line)

            clean_text = "\n".join(clean_lines)

            if clean_text:
                print(f"Extracted {len(clean_text.split())} words in {elapsed:.1f}s")
                return clean_text

        print(f"No text found (took {elapsed:.1f}s)")
        return ""

    except Exception as e:
        print(f"OCR error: {e}")
        return ""

