from __future__ import annotations

import ast
from pathlib import Path
import unittest
from unittest.mock import patch

import cv2
import numpy as np

from extraction.ocr_engine import (
    OCREngineConfig,
    OCRBinaryUnavailableError,
    OCRExecutionError,
    OCRInputError,
    ocr_image,
)


def gray_image() -> np.ndarray:
    image = np.full((6, 8), 200, dtype=np.uint8)
    image[1:3, 2:6] = 90
    return image


def bgr_image() -> np.ndarray:
    return np.dstack([gray_image(), gray_image(), gray_image()])


def bgra_image() -> np.ndarray:
    alpha = np.full((6, 8, 1), 255, dtype=np.uint8)
    return np.concatenate([bgr_image(), alpha], axis=2)


class RecordingReader:
    def __init__(self, output="  line1\r\nline2  "):
        self.output = output
        self.calls = []

    def __call__(self, image, **kwargs):
        self.calls.append((image.copy(), dict(kwargs)))
        return self.output


class OCREngineTest(unittest.TestCase):
    def test_grayscale_image_calls_injected_reader(self):
        reader = RecordingReader("  ok  ")
        text = ocr_image(gray_image(), tesseract_reader=reader)
        self.assertEqual(text, "ok")
        self.assertEqual(len(reader.calls), 1)
        np.testing.assert_array_equal(reader.calls[0][0], cv2.threshold(gray_image(), 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1])
        self.assertEqual(reader.calls[0][1]["lang"], "eng")
        self.assertEqual(reader.calls[0][1]["config"], "--oem 3 --psm 6")

    def test_bgr_image_is_converted_before_ocr(self):
        reader = RecordingReader("text")
        text = ocr_image(bgr_image(), tesseract_reader=reader)
        self.assertEqual(text, "text")
        self.assertEqual(reader.calls[0][0].ndim, 2)
        self.assertEqual(reader.calls[0][1]["lang"], "eng")

    def test_bgra_image_is_converted_before_ocr(self):
        reader = RecordingReader("text")
        text = ocr_image(bgra_image(), tesseract_reader=reader)
        self.assertEqual(text, "text")
        self.assertEqual(reader.calls[0][0].ndim, 2)
        self.assertEqual(reader.calls[0][1]["config"], "--oem 3 --psm 6")

    def test_thresholding_occurs_in_memory(self):
        reader = RecordingReader("text")
        original = gray_image()
        before = original.copy()
        ocr_image(original, tesseract_reader=reader)
        np.testing.assert_array_equal(original, before)
        self.assertEqual(reader.calls[0][0].dtype, np.uint8)

    def test_input_image_is_not_mutated(self):
        reader = RecordingReader("text")
        original = bgr_image()
        before = original.copy()
        ocr_image(original, tesseract_reader=reader)
        np.testing.assert_array_equal(original, before)

    def test_minimal_cleanup_is_applied(self):
        self.assertEqual(ocr_image(gray_image(), tesseract_reader=RecordingReader()), "line1\nline2")

    def test_internal_spaces_and_line_breaks_are_preserved(self):
        reader = RecordingReader("alpha  beta\n gamma")
        self.assertEqual(ocr_image(gray_image(), tesseract_reader=reader), "alpha  beta\n gamma")

    def test_none_reader_output_becomes_empty_text(self):
        reader = RecordingReader(None)
        self.assertEqual(ocr_image(gray_image(), tesseract_reader=reader), "")

    def test_invalid_none_input_raises(self):
        with self.assertRaises(OCRInputError):
            ocr_image(None)

    def test_empty_image_raises(self):
        with self.assertRaises(OCRInputError):
            ocr_image(np.zeros((0, 4), dtype=np.uint8))

    def test_unsupported_rank_raises(self):
        with self.assertRaises(OCRInputError):
            ocr_image(np.zeros((3, 3, 3, 1), dtype=np.uint8))

    def test_unsupported_channel_count_raises(self):
        with self.assertRaises(OCRInputError):
            ocr_image(np.zeros((3, 3, 2), dtype=np.uint8))

    def test_invalid_config_raises(self):
        with self.assertRaises(OCRInputError):
            ocr_image(gray_image(), config={"preprocessing_variant": "bad"})

    def test_missing_tesseract_binary_maps_to_binary_unavailable(self):
        import pytesseract

        with patch("extraction.ocr_engine.pytesseract.image_to_string", side_effect=pytesseract.TesseractNotFoundError()):
            with self.assertRaises(OCRBinaryUnavailableError):
                ocr_image(gray_image())

    def test_pytesseract_is_called_with_explicit_keywords(self):
        import pytesseract

        with patch("extraction.ocr_engine.pytesseract.image_to_string", return_value="  hello  ") as mocked:
            self.assertEqual(ocr_image(gray_image()), "hello")
        mocked.assert_called_once()
        _, kwargs = mocked.call_args
        self.assertEqual(kwargs["lang"], "eng")
        self.assertEqual(kwargs["config"], "--oem 3 --psm 6")
        self.assertNotIn("-l eng", kwargs["config"])

    def test_other_reader_failure_maps_to_execution_error(self):
        with patch("extraction.ocr_engine.pytesseract.image_to_string", side_effect=RuntimeError("boom")):
            with self.assertRaises(OCRExecutionError):
                ocr_image(gray_image())

    def test_module_defaults_are_immutable(self):
        config = OCREngineConfig()
        with self.assertRaises(Exception):
            config.language = "fra"

    def test_no_forbidden_imports(self):
        source = Path("extraction/ocr_engine.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        imported_roots = {
            alias.name.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        }
        imported_roots.update(
            (node.module or "").split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.level == 0
        )
        forbidden = {"camera", "job_worker", "api", "requests", "supabase", "backend", "frontend", "EasyOCR", "easyocr", "PaddleOCR", "paddleocr", "parser"}
        self.assertTrue(imported_roots.isdisjoint(forbidden))

    def test_separate_calls_do_not_share_buffers(self):
        reader = RecordingReader("text")
        first = ocr_image(gray_image(), tesseract_reader=reader)
        second = ocr_image(gray_image(), tesseract_reader=reader)
        self.assertEqual(first, "text")
        self.assertEqual(second, "text")
        self.assertEqual(len(reader.calls), 2)
        self.assertIsNot(reader.calls[0][0], reader.calls[1][0])

    def test_no_disk_writes_occur(self):
        reader = RecordingReader("text")
        with patch("extraction.ocr_engine.cv2.imwrite") as mocked_write:
            ocr_image(gray_image(), tesseract_reader=reader)
        mocked_write.assert_not_called()


if __name__ == "__main__":
    unittest.main()
