from __future__ import annotations

import ast
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np

from extraction.psa_birth_row_cropper import crop_psa_birth_name_rows
from extraction.psa_birth_row_ocr import (
    PSABirthRowOCRConfig,
    PSABirthRowOCROutput,
    extract_psa_birth_row_text,
)
from extraction.ocr_engine import OCRBinaryUnavailableError


WIDTH = 1400
HEIGHT = 1375


def registered_image(fill: int = 240) -> np.ndarray:
    image = np.full((HEIGHT, WIDTH, 3), fill, dtype=np.uint8)
    image[:, :4] = 10
    image[:, -4:] = 20
    image[:4, :] = 30
    image[-4:, :] = 40
    return image


def crop_output():
    registration = crop_psa_birth_name_rows(registered_image())
    return registration.data


class RecordingReader:
    def __init__(self, outputs=None, fail_on=None):
        self.outputs = list(outputs or [])
        self.fail_on = set(fail_on or [])
        self.calls = []
        self.seen_shares = []

    def __call__(self, image):
        self.calls.append(image)
        self.seen_shares.append(
            (
                np.shares_memory(image, registered_image()),
                image.flags.writeable,
                image.shape,
            )
        )
        index = len(self.calls) - 1
        if index in self.fail_on:
            raise RuntimeError("ocr failure")
        if index < len(self.outputs):
            return self.outputs[index]
        return ""


def issue_codes(result):
    return {issue["code"] for issue in result.issues}


class PSABirthRowOCRTest(unittest.TestCase):
    def test_valid_crop_output_returns_exactly_three_field_results(self):
        reader = RecordingReader(outputs=["A", "B", "C"])
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=reader)

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIsInstance(result.data, PSABirthRowOCROutput)
        self.assertEqual(result.data.field_count, 3)
        self.assertEqual([field.name for field in result.data.fields], ["child_name", "mother_maiden_name", "father_name"])
        self.assertEqual(len(reader.calls), 3)

    def test_each_reader_result_maps_to_correct_field(self):
        reader = RecordingReader(outputs=["child", "mother", "father"])
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=reader)

        mapped = {field.name: field.raw_text for field in result.data.fields}
        self.assertEqual(mapped["child_name"], "child")
        self.assertEqual(mapped["mother_maiden_name"], "mother")
        self.assertEqual(mapped["father_name"], "father")

    def test_all_field_results_require_review(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        self.assertTrue(all(field.review_required for field in result.data.fields))
        self.assertTrue(all(field.success for field in result.data.fields))
        self.assertEqual(result.status, "review_required")

    def test_stage_status_is_review_required_when_all_succeed(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertIn("OCR_MANUAL_REVIEW_REQUIRED", issue_codes(result))

    def test_preprocessing_variant_is_registered_whole_row_ocr(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        self.assertTrue(all(field.preprocessing_variant == "registered_whole_row_ocr" for field in result.data.fields))

    def test_ocr_attempts_are_one_per_field(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        self.assertTrue(all(field.ocr_attempts == 1 for field in result.data.fields))
        self.assertEqual(result.metrics["total_ocr_attempts"], 3)

    def test_leading_and_trailing_whitespace_is_stripped(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["  child  ", "\tmother\n", " father \r\n"]))
        self.assertEqual([field.raw_text for field in result.data.fields], ["child", "mother", "father"])

    def test_internal_spaces_and_line_breaks_are_preserved(self):
        text = "first  middle\nlast"
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=[text, text, text]))
        self.assertEqual(result.data.fields[0].raw_text, text)

    def test_blank_ocr_text_records_empty_text(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["", "", ""]))
        self.assertTrue(result.success)
        self.assertIn("OCR_TEXT_EMPTY", issue_codes(result))
        self.assertEqual(result.metrics["empty_text_count"], 3)

    def test_none_returned_by_reader_becomes_empty_text(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=[None, None, None]))
        self.assertTrue(result.success)
        self.assertTrue(all(field.raw_text == "" for field in result.data.fields))

    def test_one_ocr_exception_produces_partial_failure(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["child", "mother"], fail_on={2}))
        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertIn("OCR_PARTIAL_FAILURE", issue_codes(result))
        self.assertEqual(result.data.fields[2].raw_text, "")
        self.assertIn("OCR_EXECUTION_FAILED", result.data.fields[2].issue_codes)

    def test_two_ocr_exceptions_still_return_three_fields(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["child"], fail_on={1, 2}))
        self.assertTrue(result.success)
        self.assertEqual(len(result.data.fields), 3)
        self.assertEqual(sum(not field.success for field in result.data.fields), 2)

    def test_all_ocr_calls_failing_results_in_failed_stage(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(fail_on={0, 1, 2}))
        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertIn("OCR_ALL_FIELDS_FAILED", issue_codes(result))

    def test_invalid_crop_output_fails_before_ocr(self):
        reader = RecordingReader(outputs=["x", "y", "z"])
        result = extract_psa_birth_row_text(None, ocr_reader=reader)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"ROW_CROP_OUTPUT_INVALID"})
        self.assertEqual(reader.calls, [])

    def test_missing_required_crop_fails(self):
        crop = crop_output()
        bad = type(crop)(regions=crop.regions[:2], crops=crop.crops, registered_width=crop.registered_width, registered_height=crop.registered_height)
        result = extract_psa_birth_row_text(bad, ocr_reader=RecordingReader())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REQUIRED_ROW_CROP_MISSING"})

    def test_duplicate_or_unknown_crop_field_fails(self):
        crop = crop_output()
        bad = type(crop)(regions=crop.regions, crops={"child_name": crop.crops["child_name"], "mother_maiden_name": crop.crops["mother_maiden_name"], "other": crop.crops["father_name"]}, registered_width=crop.registered_width, registered_height=crop.registered_height)
        result = extract_psa_birth_row_text(bad, ocr_reader=RecordingReader())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REQUIRED_ROW_CROP_MISSING"})

    def test_empty_crop_fails(self):
        crop = crop_output()
        empty = np.zeros((0, WIDTH, 3), dtype=np.uint8)
        bad = type(crop)(regions=crop.regions, crops={"child_name": empty, "mother_maiden_name": crop.crops["mother_maiden_name"], "father_name": crop.crops["father_name"]}, registered_width=crop.registered_width, registered_height=crop.registered_height)
        result = extract_psa_birth_row_text(bad, ocr_reader=RecordingReader())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"ROW_CROP_INVALID"})

    def test_unsupported_crop_rank_fails(self):
        crop = crop_output()
        bad_crop = np.zeros((10, 10, 2), dtype=np.uint8)
        bad = type(crop)(regions=crop.regions, crops={"child_name": bad_crop, "mother_maiden_name": crop.crops["mother_maiden_name"], "father_name": crop.crops["father_name"]}, registered_width=crop.registered_width, registered_height=crop.registered_height)
        result = extract_psa_birth_row_text(bad, ocr_reader=RecordingReader())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"ROW_CROP_INVALID"})

    def test_invalid_injected_ocr_reader_fails(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=object())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"OCR_READER_INVALID"})

    def test_default_path_uses_ocr_image_when_reader_is_not_injected(self):
        with patch("extraction.psa_birth_row_ocr.ocr_image", return_value="default") as mocked:
            result = extract_psa_birth_row_text(crop_output())
        self.assertTrue(result.success)
        self.assertEqual([field.raw_text for field in result.data.fields], ["default", "default", "default"])
        self.assertEqual(mocked.call_count, 3)

    def test_injected_reader_still_overrides_default_wrapper(self):
        with patch("extraction.psa_birth_row_ocr.ocr_image", return_value="default") as mocked:
            result = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        self.assertTrue(result.success)
        self.assertEqual(mocked.call_count, 0)
        self.assertEqual([field.raw_text for field in result.data.fields], ["a", "b", "c"])

    def test_missing_binary_becomes_field_execution_failure(self):
        with patch("extraction.psa_birth_row_ocr.ocr_image", side_effect=[OCRBinaryUnavailableError("missing"), "mother", "father"]):
            result = extract_psa_birth_row_text(crop_output())
        self.assertTrue(result.success)
        self.assertIn("OCR_PARTIAL_FAILURE", issue_codes(result))
        self.assertTrue(any(not field.success for field in result.data.fields))

    def test_all_missing_binary_failures_produce_failed_stage(self):
        with patch("extraction.psa_birth_row_ocr.ocr_image", side_effect=OCRBinaryUnavailableError("missing")):
            result = extract_psa_birth_row_text(crop_output())
        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertIn("OCR_ALL_FIELDS_FAILED", issue_codes(result))

    def test_upstream_review_required_propagates(self):
        registration = crop_output()
        wrapped = type("Wrapped", (), {"status": "review_required", "issues": [{"code": "REGISTRATION_REVIEW_PROPAGATED"}], "data": registration})()
        result = extract_psa_birth_row_text(wrapped, ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertIn("REGISTRATION_REVIEW_PROPAGATED", issue_codes(result))
        self.assertTrue(result.metrics["upstream_review_propagated"])

    def test_source_crops_are_not_mutated(self):
        crop = crop_output()
        before = {name: arr.copy() for name, arr in crop.crops.items()}
        extract_psa_birth_row_text(crop, ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        for name, arr in crop.crops.items():
            np.testing.assert_array_equal(arr, before[name])

    def test_ocr_calls_receive_independent_inputs(self):
        reader = RecordingReader(outputs=["a", "b", "c"])
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=reader)
        self.assertTrue(result.success)
        self.assertTrue(all(shared is False for shared, _, _ in reader.seen_shares))

    def test_module_defaults_cannot_be_mutated(self):
        config = PSABirthRowOCRConfig()
        with self.assertRaises(Exception):
            config.preprocessing_variant = "x"
        with self.assertRaises(ValueError):
            PSABirthRowOCRConfig(required_fields=("child_name", "father_name", "mother_maiden_name"))

    def test_separate_calls_return_independent_result_objects(self):
        first = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["a", "b", "c"]))
        second = extract_psa_birth_row_text(crop_output(), ocr_reader=RecordingReader(outputs=["d", "e", "f"]))
        self.assertIsNot(first.data, second.data)
        self.assertIsNot(first.data.fields, second.data.fields)

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path("extraction/psa_birth_row_ocr.py").read_text(encoding="utf-8")
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


if __name__ == "__main__":
    unittest.main()
