import unittest
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.modules.setdefault(
    "pytesseract",
    SimpleNamespace(Output=SimpleNamespace(DICT="dict"), image_to_data=MagicMock()),
)
sys.modules.setdefault(
    "ocr",
    SimpleNamespace(OCR_TIMEOUT_SECONDS=25.0, fast_preprocess=MagicMock()),
)

from pipeline.grade_form_v1 import scan_grade_form


def tesseract_data(lines):
    data = {
        "text": [], "conf": [], "block_num": [], "par_num": [], "line_num": [],
    }
    for line_number, line in enumerate(lines, start=1):
        for word, confidence in line:
            data["text"].append(word)
            data["conf"].append(str(confidence))
            data["block_num"].append(1)
            data["par_num"].append(1)
            data["line_num"].append(line_number)
    return data


class GradeFormPipelineTests(unittest.TestCase):
    @patch("pipeline.grade_form_v1.pytesseract.image_to_data")
    @patch("pipeline.grade_form_v1.fast_preprocess")
    def test_registered_form_extracts_gwa_with_real_confidence(self, preprocess, image_to_data):
        preprocess.return_value = object()
        image_to_data.return_value = tesseract_data([
            [("Student", 94), ("Number:", 95), ("2023-001234", 93)],
            [("Name:", 92), ("JUAN", 93), ("DELA", 91), ("CRUZ", 95)],
            [("Course:", 90), ("BSIT", 91)],
            [("Semester:", 95), ("1st", 96), ("Semester", 94)],
            [("Academic", 97), ("Year:", 96), ("2025-2026", 97)],
            [("GWA:", 98), ("1.63", 96)],
        ])

        result = scan_grade_form("capture.jpg")

        self.assertTrue(result.matched)
        self.assertEqual(result.fields["gwa"]["normalized_value"], "1.63")
        self.assertEqual(result.field_confidence["gwa"], 97.0)
        preprocess.assert_called_once_with("capture.jpg")
        image_to_data.assert_called_once()

    @patch("pipeline.grade_form_v1.pytesseract.image_to_data")
    @patch("pipeline.grade_form_v1.fast_preprocess")
    def test_template_mismatch_returns_no_guessed_fields(self, preprocess, image_to_data):
        preprocess.return_value = object()
        image_to_data.return_value = tesseract_data([[("Unrelated", 90), ("document", 90)]])

        result = scan_grade_form("capture.jpg")

        self.assertFalse(result.matched)
        self.assertEqual(result.fields, {})
        self.assertEqual(result.field_confidence, {})


if __name__ == "__main__":
    unittest.main()
