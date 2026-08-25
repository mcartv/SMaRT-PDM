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
            [("Academic", 97), ("Year:", 96), ("1st", 97), ("Year", 96)],
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

    @patch("pipeline.grade_form_v1.pytesseract.image_to_data")
    @patch("pipeline.grade_form_v1.fast_preprocess")
    def test_separate_header_labels_extract_visible_grade_form_values(
        self,
        preprocess,
        image_to_data,
    ):
        preprocess.return_value = object()
        image_to_data.return_value = tesseract_data([
            [("STUDENT", 91), ("NUMBER", 92), ("STUDENT", 90), ("NAME", 93), ("COURSE", 94), (":", 88)],
            [("PDM-2023-003137", 96), ("Petima,", 92), ("Venice", 93), ("Eve", 91), ("BsiT", 95)],
            [("COPY", 90), ("OF", 91), ("GRADEFOR", 94), ("THE", 93), ("PERIOD:", 91), ("1st", 94), ("2023-2024", 96)],
            [("IT", 90), ("411", 91), ("3", 92), ("1.75", 95), ("PASSED", 94)],
            [("GWA:", 97), ("1.59", 98)],
        ])

        result = scan_grade_form("capture.jpg")

        self.assertTrue(result.matched)
        self.assertEqual(result.fields["student_number"]["normalized_value"], "PDM-2023-003137")
        self.assertEqual(result.fields["student_name"]["normalized_value"], "Petima, Venice Eve")
        self.assertEqual(result.fields["course"]["normalized_value"], "BsiT")
        self.assertEqual(result.fields["semester"]["normalized_value"], "1st Semester")
        self.assertEqual(result.fields["academic_year"]["normalized_value"], "1st")
        self.assertEqual(result.fields["gwa"]["normalized_value"], "1.59")
        self.assertIsNotNone(result.field_confidence["student_name"])

    @patch("pipeline.grade_form_v1.pytesseract.image_to_data")
    @patch("pipeline.grade_form_v1.fast_preprocess")
    def test_academic_year_comes_from_noisy_grade_period_label(
        self,
        preprocess,
        image_to_data,
    ):
        preprocess.return_value = object()
        image_to_data.return_value = tesseract_data([
            [("Student", 94), ("Number:", 95), ("PDM-2023-003137", 93)],
            [("Name:", 92), ("VENICE", 93), ("PELIMA", 91)],
            [("Course:", 90), ("BSIT", 91)],
            [("COPY", 92), ("OF", 92), ("GRADE", 93), ("FOR", 94),
             ("THEPERIODOO:", 88), ("1st", 94)],
            [("GWA:", 97), ("1.89", 98)],
        ])

        result = scan_grade_form("capture.jpg")

        self.assertTrue(result.matched)
        self.assertEqual(
            result.fields["academic_year"]["normalized_value"],
            "1st",
        )
        self.assertEqual(
            result.fields["semester"]["normalized_value"],
            "1st Semester",
        )

    @patch("pipeline.grade_form_v1.pytesseract.image_to_data")
    @patch("pipeline.grade_form_v1.fast_preprocess")
    def test_gwa_accepts_common_tesseract_label_and_decimal_errors(
        self,
        preprocess,
        image_to_data,
    ):
        preprocess.return_value = object()
        image_to_data.return_value = tesseract_data([
            [("Student", 94), ("Number:", 95), ("2023-001234", 93)],
            [("Name:", 92), ("JUAN", 93), ("DELA", 91), ("CRUZ", 95)],
            [("Course:", 90), ("BSIT", 91)],
            [("Semester:", 95), ("1st", 96), ("Semester", 94)],
            [("Academic", 97), ("Year:", 96), ("1st", 97), ("Year", 96)],
            [("OWA.", 96), ("1,69", 95)],
        ])

        result = scan_grade_form("capture.jpg")

        self.assertTrue(result.matched)
        self.assertEqual(result.fields["gwa"]["normalized_value"], "1.69")
        self.assertEqual(result.field_confidence["gwa"], 95.5)


if __name__ == "__main__":
    unittest.main()
