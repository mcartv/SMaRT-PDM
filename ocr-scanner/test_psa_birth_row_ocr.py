from __future__ import annotations

import ast
from pathlib import Path
import unittest
from unittest.mock import patch

import cv2
import numpy as np

from extraction.ocr_engine import OCRBinaryUnavailableError
from extraction.psa_birth_row_cropper import crop_psa_birth_name_rows
from extraction.psa_birth_row_ocr import (
    PREPROCESSING_VARIANT,
    PSABirthRowOCRConfig,
    PSABirthRowOCROutput,
    extract_psa_birth_row_text,
)


WIDTH = 1400
HEIGHT = 1375


def registered_image(fill: int = 240) -> np.ndarray:
    image = np.full((HEIGHT, WIDTH, 3), fill, dtype=np.uint8)
    image[:, :4] = 10
    image[:, -4:] = 20
    image[:4, :] = 30
    image[-4:, :] = 40
    return image


def crop_output(fill: int = 240):
    registration = crop_psa_birth_name_rows(registered_image(fill=fill))
    return registration.data


class RecordingReader:
    def __init__(self, outputs=None, fail_on=None):
        self.outputs = list(outputs or [])
        self.fail_on = set(fail_on or [])
        self.calls = []

    def __call__(self, image):
        self.calls.append(image)
        index = len(self.calls) - 1
        if index in self.fail_on:
            raise RuntimeError("ocr failure")
        if index < len(self.outputs):
            return self.outputs[index]
        return ""


def issue_codes(result):
    return {issue["code"] for issue in result.issues}


def mapped_fields(result):
    return {field.name: field for field in result.data.fields}


class PSABirthRowOCRTest(unittest.TestCase):
    def test_valid_crop_output_returns_exactly_three_fields(self):
        reader = RecordingReader(
            outputs=["CHILD SAMPLE", "MOTHER SAMPLE", "FATHER SAMPLE"]
        )
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=reader)

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIsInstance(result.data, PSABirthRowOCROutput)
        self.assertEqual(result.data.field_count, 3)
        self.assertEqual(
            [field.name for field in result.data.fields],
            ["child_name", "mother_maiden_name", "father_name"],
        )
        self.assertEqual(len(reader.calls), 3)

    def test_each_reader_result_maps_to_correct_field(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        mapped = {field.name: field.raw_text for field in result.data.fields}
        self.assertEqual(mapped["child_name"], "ALPHA ONE")
        self.assertEqual(mapped["mother_maiden_name"], "BETA TWO")
        self.assertEqual(mapped["father_name"], "GAMMA THREE")

    def test_form_labels_and_neighboring_fields_are_removed(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=[
                    "1. NAME First Middle Last\nALPHA BETA GAMMA\n2. SEX 3. DATE OF BIRTH",
                    "6. MOTHER'S MAIDEN NAME\nDELTA EPSILON ZETA",
                    "13. NAME OF FATHER\nETA THETA IOTA",
                ]
            ),
        )
        mapped = {field.name: field.raw_text for field in result.data.fields}
        self.assertEqual(mapped["child_name"], "ALPHA BETA GAMMA")
        self.assertEqual(mapped["mother_maiden_name"], "DELTA EPSILON ZETA")
        self.assertEqual(mapped["father_name"], "ETA THETA IOTA")

    def test_numeric_and_symbol_dominated_text_is_not_exposed(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=[
                    "2. SEX 3. DATE OF BIRTH 2026-07-24",
                    "@ # 100 200",
                    "13. NAME OF FATHER",
                ]
            ),
        )
        mapped = mapped_fields(result)
        self.assertFalse(mapped["child_name"].success)
        self.assertFalse(mapped["mother_maiden_name"].success)
        self.assertEqual(mapped["child_name"].raw_text, "")
        self.assertEqual(mapped["mother_maiden_name"].raw_text, "")

    def test_all_fields_require_human_review(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        self.assertTrue(all(field.review_required for field in result.data.fields))
        self.assertEqual(result.status, "review_required")
        self.assertIn("OCR_MANUAL_REVIEW_REQUIRED", issue_codes(result))

    def test_preprocessing_variant_is_name_cell_ocr(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        self.assertTrue(
            all(
                field.preprocessing_variant == PREPROCESSING_VARIANT
                for field in result.data.fields
            )
        )
        self.assertTrue(result.metrics["name_cell_crop_used"])
        self.assertFalse(result.metrics["full_page_generic_ocr_used"])

    def test_ocr_attempts_are_exactly_one_per_field(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        self.assertTrue(all(field.ocr_attempts == 1 for field in result.data.fields))
        self.assertEqual(result.metrics["total_ocr_attempts"], 3)

    def test_reader_receives_preprocessed_single_channel_cells(self):
        reader = RecordingReader(
            outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
        )
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=reader)
        self.assertTrue(result.success)
        self.assertEqual(len(reader.calls), 3)
        self.assertTrue(all(image.ndim == 2 for image in reader.calls))
        self.assertTrue(all(image.shape[0] >= 120 for image in reader.calls))
        self.assertTrue(all(image.flags.c_contiguous for image in reader.calls))

    def test_grid_lines_are_removed_before_ocr(self):
        source = registered_image()
        crop = crop_psa_birth_name_rows(source).data
        child = crop.crops["child_name"].copy()
        cv2.line(child, (0, 10), (child.shape[1] - 1, 10), (0, 0, 0), 3)
        cv2.line(child, (20, 0), (20, child.shape[0] - 1), (0, 0, 0), 3)
        mutated = type(crop)(
            regions=crop.regions,
            crops={**dict(crop.crops), "child_name": child},
            registered_width=crop.registered_width,
            registered_height=crop.registered_height,
        )
        reader = RecordingReader(
            outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
        )
        result = extract_psa_birth_row_text(mutated, ocr_reader=reader)
        self.assertTrue(result.success)
        processed = reader.calls[0]
        self.assertGreater(float(np.mean(processed[10:14, :])), 180.0)

    def test_whitespace_is_normalized_to_one_clean_line(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=[
                    "  ALPHA   BETA  ",
                    "\tGAMMA    DELTA\n",
                    " EPSILON   ZETA \r\n",
                ]
            ),
        )
        self.assertEqual(
            [field.raw_text for field in result.data.fields],
            ["ALPHA BETA", "GAMMA DELTA", "EPSILON ZETA"],
        )

    def test_address_and_form_labels_are_not_accepted_as_names(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=[
                    "House No Street Barangay",
                    "Hospital Clinic Institution",
                    "Residence Address Province",
                ]
            ),
        )
        self.assertTrue(
            all(field.raw_text == "" for field in result.data.fields)
        )
        mapped = mapped_fields(result)
        self.assertFalse(mapped["child_name"].success)
        self.assertFalse(mapped["mother_maiden_name"].success)

    def test_apostrophes_hyphens_and_periods_are_preserved(self):
        text = "D'ALPHA BETA-GAMMA J."
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs=[text, text, text]),
        )
        self.assertEqual(result.data.fields[0].raw_text, text)

    def test_blank_child_and_mother_fields_fail_cleanly(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs=["", "", "GAMMA THREE"]),
        )
        fields = mapped_fields(result)
        self.assertFalse(fields["child_name"].success)
        self.assertFalse(fields["mother_maiden_name"].success)
        self.assertEqual(fields["child_name"].raw_text, "")
        self.assertEqual(fields["mother_maiden_name"].raw_text, "")
        self.assertIn("OCR_PARTIAL_FAILURE", issue_codes(result))

    def test_visually_blank_father_section_is_controlled_blank(self):
        result = extract_psa_birth_row_text(
            crop_output(fill=255),
            ocr_reader=RecordingReader(outputs=["ALPHA ONE", "BETA TWO", ""]),
        )
        father = mapped_fields(result)["father_name"]
        self.assertTrue(father.success)
        self.assertEqual(father.raw_text, "")
        self.assertIn("FATHER_SECTION_BLANK", father.issue_codes)
        self.assertEqual(result.metrics["blank_father_count"], 1)

    def test_nonblank_unreadable_father_section_fails(self):
        crop = crop_output(fill=255)
        father = crop.crops["father_name"].copy()
        father[10:40, 20:300] = 0
        mutated = type(crop)(
            regions=crop.regions,
            crops={**dict(crop.crops), "father_name": father},
            registered_width=crop.registered_width,
            registered_height=crop.registered_height,
        )
        result = extract_psa_birth_row_text(
            mutated,
            ocr_reader=RecordingReader(outputs=["ALPHA ONE", "BETA TWO", ""]),
        )
        father_result = mapped_fields(result)["father_name"]
        self.assertFalse(father_result.success)
        self.assertIn("OCR_TEXT_EMPTY", father_result.issue_codes)

    def test_one_ocr_exception_produces_partial_failure(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO"],
                fail_on={2},
            ),
        )
        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertIn("OCR_PARTIAL_FAILURE", issue_codes(result))
        self.assertFalse(mapped_fields(result)["father_name"].success)

    def test_all_ocr_calls_failing_results_in_failed_stage(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(fail_on={0, 1, 2}),
        )
        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertIn("OCR_ALL_FIELDS_FAILED", issue_codes(result))

    def test_invalid_crop_output_fails_before_ocr(self):
        reader = RecordingReader(outputs=["A", "B", "C"])
        result = extract_psa_birth_row_text(None, ocr_reader=reader)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"ROW_CROP_OUTPUT_INVALID"})
        self.assertEqual(reader.calls, [])

    def test_missing_required_crop_fails(self):
        crop = crop_output()
        bad = type(crop)(
            regions=crop.regions[:2],
            crops=crop.crops,
            registered_width=crop.registered_width,
            registered_height=crop.registered_height,
        )
        result = extract_psa_birth_row_text(bad, ocr_reader=RecordingReader())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REQUIRED_ROW_CROP_MISSING"})

    def test_empty_crop_fails(self):
        crop = crop_output()
        empty = np.zeros((0, WIDTH, 3), dtype=np.uint8)
        bad = type(crop)(
            regions=crop.regions,
            crops={**dict(crop.crops), "child_name": empty},
            registered_width=crop.registered_width,
            registered_height=crop.registered_height,
        )
        result = extract_psa_birth_row_text(bad, ocr_reader=RecordingReader())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"ROW_CROP_INVALID"})

    def test_invalid_injected_ocr_reader_fails(self):
        result = extract_psa_birth_row_text(crop_output(), ocr_reader=object())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"OCR_READER_INVALID"})

    def test_default_path_uses_ocr_image_once_per_field(self):
        with patch(
            "extraction.psa_birth_row_ocr.ocr_image",
            side_effect=["ALPHA ONE", "BETA TWO", "GAMMA THREE"],
        ) as mocked:
            result = extract_psa_birth_row_text(crop_output())
        self.assertTrue(result.success)
        self.assertEqual(mocked.call_count, 3)

    def test_injected_reader_overrides_default_wrapper(self):
        with patch(
            "extraction.psa_birth_row_ocr.ocr_image",
            return_value="DEFAULT VALUE",
        ) as mocked:
            result = extract_psa_birth_row_text(
                crop_output(),
                ocr_reader=RecordingReader(
                    outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
                ),
            )
        self.assertTrue(result.success)
        self.assertEqual(mocked.call_count, 0)

    def test_missing_binary_becomes_field_execution_failure(self):
        with patch(
            "extraction.psa_birth_row_ocr.ocr_image",
            side_effect=[
                OCRBinaryUnavailableError("missing"),
                "BETA TWO",
                "GAMMA THREE",
            ],
        ):
            result = extract_psa_birth_row_text(crop_output())
        self.assertTrue(result.success)
        self.assertIn("OCR_PARTIAL_FAILURE", issue_codes(result))

    def test_upstream_review_required_propagates(self):
        registration = crop_output()
        wrapped = type(
            "Wrapped",
            (),
            {
                "status": "review_required",
                "issues": [{"code": "REGISTRATION_REVIEW_PROPAGATED"}],
                "data": registration,
            },
        )()
        result = extract_psa_birth_row_text(
            wrapped,
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        self.assertTrue(result.success)
        self.assertIn("REGISTRATION_REVIEW_PROPAGATED", issue_codes(result))
        self.assertTrue(result.metrics["upstream_review_propagated"])

    def test_source_crops_are_not_mutated(self):
        crop = crop_output()
        before = {name: array.copy() for name, array in crop.crops.items()}
        extract_psa_birth_row_text(
            crop,
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        for name, array in crop.crops.items():
            np.testing.assert_array_equal(array, before[name])

    def test_metrics_are_privacy_safe(self):
        private_values = ["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs=private_values),
        )
        serialized_metrics = repr(dict(result.metrics))
        for value in private_values:
            self.assertNotIn(value, serialized_metrics)
        self.assertIn("total_processing_seconds", result.metrics)
        self.assertIn("ocr_seconds", result.metrics)


    def test_legacy_preprocessing_variant_is_normalized(self):
        config = PSABirthRowOCRConfig(
            preprocessing_variant="registered_whole_row_ocr"
        )
        self.assertEqual(config.preprocessing_variant, PREPROCESSING_VARIANT)

    def test_module_defaults_cannot_be_mutated(self):
        config = PSABirthRowOCRConfig()
        with self.assertRaises(Exception):
            config.preprocessing_variant = "x"
        with self.assertRaises(ValueError):
            PSABirthRowOCRConfig(
                required_fields=(
                    "child_name",
                    "father_name",
                    "mother_maiden_name",
                )
            )

    def test_separate_calls_return_independent_results(self):
        first = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["ALPHA ONE", "BETA TWO", "GAMMA THREE"]
            ),
        )
        second = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(
                outputs=["DELTA FOUR", "EPSILON FIVE", "ZETA SIX"]
            ),
        )
        self.assertIsNot(first.data, second.data)
        self.assertIsNot(first.data.fields, second.data.fields)

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path("extraction/psa_birth_row_ocr.py").read_text(
            encoding="utf-8"
        )
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
        forbidden = {
            "camera",
            "job_worker",
            "api",
            "requests",
            "supabase",
            "backend",
            "frontend",
            "EasyOCR",
            "easyocr",
            "PaddleOCR",
            "paddleocr",
            "parser",
        }
        self.assertTrue(imported_roots.isdisjoint(forbidden))


if __name__ == "__main__":
    unittest.main()
