from __future__ import annotations

import ast
from pathlib import Path
import unittest
from unittest.mock import patch

import cv2
import numpy as np

from extraction.ocr_engine import OCRBinaryUnavailableError
from extraction.paddle_birth_recognizer import PaddleBirthOCRUnavailable
from extraction.psa_birth_row_cropper import crop_psa_birth_name_rows
from extraction.psa_birth_row_ocr import (
    PREPROCESSING_VARIANT,
    PSABirthRowOCRConfig,
    PSABirthRowOCROutput,
    extract_psa_birth_row_text,
    preprocess_for_paddle,
    preprocess_psa_watermark,
)


WIDTH = 1400
HEIGHT = 1375
ROW_GEOMETRIES = (
    ("child_name", 358, 652, 963, 1248, 50, 104),
    ("mother_maiden_name", 321, 587, 923, 1211, 685, 732),
    ("father_name", 278, 580, 921, 1268, 1238, 1290),
)


def form_image() -> np.ndarray:
    image = np.full((HEIGHT, WIDTH, 3), 255, dtype=np.uint8)
    for _name, left, first, middle, right, value_top, value_bottom in ROW_GEOMETRIES:
        top = value_top - 3
        bottom = value_bottom + 3
        cv2.line(image, (left, top), (right, top), (0, 0, 0), 2)
        cv2.line(image, (left, bottom), (right, bottom), (0, 0, 0), 2)
        for divider in (left, first, middle, right):
            cv2.line(
                image,
                (divider, top),
                (divider, bottom),
                (0, 0, 0),
                4,
            )
    return image


def crop_output():
    result = crop_psa_birth_name_rows(form_image())
    if not result.success:
        raise AssertionError(result.issues)
    return result.data


class RecordingReader:
    def __init__(self, outputs=(), fail_on=()):
        self.outputs = list(outputs)
        self.fail_on = set(fail_on)
        self.calls = []

    def __call__(self, image):
        self.calls.append(image)
        index = len(self.calls) - 1
        if index in self.fail_on:
            raise RuntimeError("synthetic OCR failure")
        return self.outputs[index] if index < len(self.outputs) else ""


def valid_outputs():
    return [
        "Alpha",
        "Beta",
        "Gamma",
        "Delta",
        "Epsilon",
        "Zeta",
        "Eta",
        "Theta",
        "Iota",
    ]


def row_data_reader(rows):
    values = iter(rows)

    def reader(image, **_kwargs):
        first, middle, last = next(values)
        width = image.shape[1]
        texts = [first, middle, last]
        return {
            "text": texts,
            "conf": [94.0, 88.0, 92.0],
            "left": [int(width * 0.08), int(width * 0.40), int(width * 0.76)],
            "width": [max(10, int(width * 0.08))] * 3,
        }

    return reader


def mapped_fields(result):
    return {field.name: field for field in result.data.fields}


def issue_codes(result):
    return {issue["code"] for issue in result.issues}


class PSABirthRowOCRTest(unittest.TestCase):
    def setUp(self):
        self._paddle_unavailable = patch(
            "extraction.psa_birth_row_ocr.recognize_birth_name_batch",
            side_effect=PaddleBirthOCRUnavailable("not installed in unit test"),
        )
        self._paddle_unavailable.start()
        self.addCleanup(self._paddle_unavailable.stop)

    def test_watermark_fallback_preserves_shape_contract_without_mutating_crop(self):
        crop = np.full((48, 240, 3), 245, dtype=np.uint8)
        cv2.putText(
            crop,
            "SARMIENTO",
            (8, 33),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (15, 15, 15),
            2,
            cv2.LINE_AA,
        )
        cv2.line(crop, (0, 12), (239, 12), (215, 185, 220), 2)
        original = crop.copy()

        processed, ink_ratio = preprocess_psa_watermark(crop, 140)

        self.assertEqual(processed.dtype, np.uint8)
        self.assertEqual(processed.ndim, 2)
        self.assertGreaterEqual(processed.shape[0], 168)
        self.assertGreater(ink_ratio, 0.0)
        np.testing.assert_array_equal(crop, original)

    def test_paddle_preprocessing_preserves_tonal_detail_without_thresholding(self):
        gradient = np.tile(
            np.arange(80, 240, dtype=np.uint8),
            (48, 1),
        )
        crop = cv2.cvtColor(gradient, cv2.COLOR_GRAY2BGR)
        original = crop.copy()

        with patch(
            "extraction.psa_birth_row_ocr.cv2.threshold",
            side_effect=AssertionError("Paddle preprocessing must not threshold"),
        ), patch(
            "extraction.psa_birth_row_ocr.cv2.adaptiveThreshold",
            side_effect=AssertionError("Paddle preprocessing must not threshold"),
        ), patch(
            "extraction.psa_birth_row_ocr.cv2.morphologyEx",
            side_effect=AssertionError("Paddle preprocessing must not morph"),
        ):
            processed = preprocess_for_paddle(crop, 140)

        self.assertEqual(processed.ndim, 3)
        self.assertEqual(processed.shape[2], 3)
        self.assertGreater(len(np.unique(processed)), 2)
        np.testing.assert_array_equal(crop, original)

    def test_nine_cells_assemble_three_structured_fields(self):
        reader = RecordingReader(valid_outputs())
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=reader,
        )

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIsInstance(result.data, PSABirthRowOCROutput)
        self.assertEqual(result.data.field_count, 3)
        self.assertEqual(len(reader.calls), 9)
        fields = mapped_fields(result)
        self.assertEqual(
            dict(fields["child_name"].components),
            {
                "first_name": "Alpha",
                "middle_name": "Beta",
                "last_name": "Gamma",
            },
        )
        self.assertEqual(fields["child_name"].raw_text, "Alpha Beta Gamma")

    def test_each_row_receives_only_its_own_cells(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(valid_outputs()),
        )
        fields = mapped_fields(result)

        self.assertEqual(fields["child_name"].raw_text, "Alpha Beta Gamma")
        self.assertEqual(
            fields["mother_maiden_name"].raw_text,
            "Delta Epsilon Zeta",
        )
        self.assertEqual(fields["father_name"].raw_text, "Eta Theta Iota")

    def test_blank_middle_name_is_valid(self):
        outputs = valid_outputs()
        outputs[1] = ""
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        child = mapped_fields(result)["child_name"]

        self.assertTrue(child.success)
        self.assertEqual(child.components["middle_name"], "")
        self.assertEqual(child.raw_text, "Alpha Gamma")

    def test_hyphen_apostrophe_and_initial_are_preserved(self):
        outputs = valid_outputs()
        outputs[0:3] = ["Alpha-Beta", "D'Gamma", "J."]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        child = mapped_fields(result)["child_name"]

        self.assertTrue(child.success)
        self.assertEqual(child.raw_text, "Alpha-Beta D'Gamma J.")

    def test_digits_and_form_labels_are_rejected(self):
        outputs = valid_outputs()
        outputs[0:3] = ["12345", "MAIDEN NAME", "DATE OF BIRTH"]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        child = mapped_fields(result)["child_name"]

        self.assertFalse(child.success)
        self.assertEqual(child.raw_text, "")
        self.assertIn("child_name_not_found", child.issue_codes)

    def test_conflicting_candidates_fail_affected_field(self):
        outputs = valid_outputs()
        outputs[0] = ["Alpha", "Different"]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        child = mapped_fields(result)["child_name"]

        self.assertFalse(child.success)
        self.assertEqual(child.components["first_name"], "")
        self.assertIn("birth_name_source_conflict", child.issue_codes)
        self.assertIn("OCR_PARTIAL_FAILURE", issue_codes(result))

    def test_blank_father_row_is_controlled_blank(self):
        outputs = valid_outputs()
        outputs[6:9] = ["", "", ""]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        father = mapped_fields(result)["father_name"]

        self.assertTrue(father.success)
        self.assertEqual(father.raw_text, "")
        self.assertIn("father_section_blank", father.issue_codes)
        self.assertEqual(result.metrics["controlled_blank_father_count"], 1)

    def test_father_not_applicable_variants_are_normalized(self):
        for sentinel in ("N/A", "N / A", "N.A.", "NA", "N-A"):
            with self.subTest(sentinel=sentinel):
                outputs = valid_outputs()
                outputs[6:9] = [sentinel, "", ""]
                result = extract_psa_birth_row_text(
                    crop_output(),
                    ocr_reader=RecordingReader(outputs),
                )
                father = mapped_fields(result)["father_name"]

                self.assertTrue(father.success)
                self.assertEqual(father.section_status, "not_applicable")
                self.assertEqual(father.raw_text, "N/A")
                self.assertEqual(
                    dict(father.components),
                    {
                        "first_name": "",
                        "middle_name": "",
                        "last_name": "",
                    },
                )
                self.assertIn(
                    "father_name_not_applicable",
                    father.issue_codes,
                )
                self.assertEqual(result.metrics["total_ocr_attempts"], 9)

    def test_not_applicable_in_any_father_cell_is_section_level(self):
        for index in (6, 7, 8):
            with self.subTest(cell=index):
                outputs = valid_outputs()
                outputs[6:9] = ["", "", ""]
                outputs[index] = "N / A"
                result = extract_psa_birth_row_text(
                    crop_output(),
                    ocr_reader=RecordingReader(outputs),
                )
                father = mapped_fields(result)["father_name"]

                self.assertTrue(father.success)
                self.assertEqual(father.section_status, "not_applicable")
                self.assertEqual(father.raw_text, "N/A")

    def test_not_applicable_mixed_with_name_is_conflict(self):
        outputs = valid_outputs()
        outputs[6:9] = ["N/A", "", "Sample"]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        father = mapped_fields(result)["father_name"]

        self.assertFalse(father.success)
        self.assertEqual(father.section_status, "incomplete")
        self.assertIn(
            "father_name_not_applicable_conflict",
            father.issue_codes,
        )
        self.assertNotEqual(father.raw_text, "N/A")

    def test_not_applicable_is_father_only(self):
        outputs = valid_outputs()
        outputs[0] = "N/A"
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        child = mapped_fields(result)["child_name"]

        self.assertFalse(child.success)
        self.assertNotEqual(child.section_status, "not_applicable")

    def test_partially_blank_father_row_is_not_declared_blank(self):
        outputs = valid_outputs()
        outputs[6:9] = ["Eta", "", ""]
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(outputs),
        )
        father = mapped_fields(result)["father_name"]

        self.assertFalse(father.success)
        self.assertIn("father_name_incomplete", father.issue_codes)
        self.assertNotIn("father_section_blank", father.issue_codes)

    def test_grid_lines_are_removed_and_cells_are_upscaled(self):
        output = crop_output()
        child = output.crops["child_name.first_name"]
        cv2.line(child, (0, 5), (child.shape[1] - 1, 5), (0, 0, 0), 3)
        cv2.line(child, (10, 0), (10, child.shape[0] - 1), (0, 0, 0), 3)
        reader = RecordingReader(valid_outputs())
        result = extract_psa_birth_row_text(output, ocr_reader=reader)

        self.assertTrue(result.success)
        self.assertGreaterEqual(reader.calls[0].shape[0], 140)
        self.assertGreater(float(np.mean(reader.calls[0][10:20, :])), 180.0)

    def test_faint_name_cells_are_contrast_enhanced_before_ocr(self):
        output = crop_output()
        faint = output.crops["child_name.first_name"]
        faint[:, :] = 246
        cv2.putText(
            faint,
            "ALPHA",
            (8, max(25, faint.shape[0] - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            205,
            1,
            cv2.LINE_AA,
        )
        reader = RecordingReader(valid_outputs())

        result = extract_psa_birth_row_text(output, ocr_reader=reader)

        self.assertTrue(result.success)
        self.assertLess(int(reader.calls[0].min()), 100)
        self.assertGreaterEqual(reader.calls[0].shape[0], 140)

    def test_exactly_nine_bounded_ocr_attempts_are_recorded(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(valid_outputs()),
        )

        self.assertEqual(result.metrics["total_ocr_attempts"], 9)
        self.assertTrue(
            all(field.ocr_attempts == 3 for field in result.data.fields)
        )
        self.assertFalse(result.metrics["full_page_generic_ocr_used"])

    def test_ocr_exception_is_contained(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(valid_outputs(), fail_on={0}),
        )
        child = mapped_fields(result)["child_name"]

        self.assertTrue(result.success)
        self.assertFalse(child.success)
        self.assertIn("OCR_EXECUTION_FAILED", child.issue_codes)

    def test_all_ocr_failures_return_failed_stage_without_fabrication(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(fail_on=range(9)),
        )

        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertEqual(issue_codes(result), {"OCR_ALL_FIELDS_FAILED"})
        self.assertTrue(
            all(field.raw_text == "" for field in result.data.fields)
        )

    def test_invalid_or_missing_crops_fail_before_ocr(self):
        reader = RecordingReader(valid_outputs())
        result = extract_psa_birth_row_text(None, ocr_reader=reader)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"ROW_CROP_OUTPUT_INVALID"})
        self.assertEqual(reader.calls, [])

        output = crop_output()
        bad = type(output)(
            regions=output.regions,
            crops={
                key: value
                for key, value in output.crops.items()
                if key != "child_name.first_name"
            },
            registered_width=output.registered_width,
            registered_height=output.registered_height,
        )
        result = extract_psa_birth_row_text(bad, ocr_reader=reader)
        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"REQUIRED_NAME_CELL_CROP_MISSING"},
        )

    def test_default_reader_uses_image_to_data_once_per_row(self):
        with patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=row_data_reader([
                ("Alpha", "Beta", "Gamma"),
                ("Delta", "Epsilon", "Zeta"),
                ("Eta", "Theta", "Iota"),
            ]),
        ) as mocked:
            result = extract_psa_birth_row_text(crop_output())

        self.assertTrue(result.success)
        self.assertEqual(mocked.call_count, 3)
        self.assertTrue(
            all(
                "--psm 7" in call.kwargs["config"]
                and call.kwargs["output_type"] is not None
                for call in mocked.call_args_list
            )
        )
        self.assertEqual(result.metrics["confidence_source"], "tesseract_image_to_data")
        self.assertEqual(mapped_fields(result)["child_name"].confidence, 91.33333333333333)

    def test_parallel_ensemble_uses_tesseract_below_paddle_threshold(self):
        keys = sorted(crop_output().crops)
        paddle_values = {
            key: ("Pedro", 0.59)
            for key in keys
        }
        with patch(
            "extraction.psa_birth_row_ocr.recognize_birth_name_batch",
            return_value=tuple(paddle_values[key] for key in keys),
        ), patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=row_data_reader([
                ("Alpha", "Beta", "Gamma"),
                ("Delta", "Epsilon", "Zeta"),
                ("Eta", "Theta", "Iota"),
            ]),
        ):
            result = extract_psa_birth_row_text(crop_output())

        self.assertTrue(result.success)
        self.assertEqual(mapped_fields(result)["child_name"].components["first_name"], "Alpha")
        self.assertEqual(result.metrics["confidence_source"], "paddleocr_tesseract_vote")
        self.assertTrue(result.metrics["ensemble_parallel"])

    def test_default_paddle_threshold_accepts_sixty_percent(self):
        self.assertEqual(
            PSABirthRowOCRConfig().paddle_confidence_threshold,
            0.60,
        )
        self.assertEqual(
            PSABirthRowOCRConfig().paddle_model_name,
            "en_PP-OCRv5_mobile_rec",
        )
        self.assertEqual(PSABirthRowOCRConfig().paddle_engine, "onnxruntime")

        keys = sorted(crop_output().crops)
        paddle_values = {
            key: ("Pedro", 0.60)
            for key in keys
        }

        def lower_confidence_tesseract(image, **_kwargs):
            width = image.shape[1]
            return {
                "text": ["Alpha", "Beta", "Gamma"],
                "conf": [55.0, 55.0, 55.0],
                "left": [
                    int(width * 0.08),
                    int(width * 0.40),
                    int(width * 0.76),
                ],
                "width": [max(10, int(width * 0.08))] * 3,
            }

        with patch(
            "extraction.psa_birth_row_ocr.recognize_birth_name_batch",
            return_value=tuple(paddle_values[key] for key in keys),
        ), patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=lower_confidence_tesseract,
        ):
            result = extract_psa_birth_row_text(crop_output())

        self.assertTrue(result.success)
        self.assertEqual(
            mapped_fields(result)["child_name"].components["first_name"],
            "Pedro",
        )

    def test_parallel_ensemble_uses_higher_confidence_on_disagreement(self):
        keys = sorted(crop_output().crops)
        paddle_values = {
            key: ("Paddle", 0.99)
            for key in keys
        }
        with patch(
            "extraction.psa_birth_row_ocr.recognize_birth_name_batch",
            return_value=tuple(paddle_values[key] for key in keys),
        ), patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=row_data_reader([
                ("Alpha", "Beta", "Gamma"),
                ("Delta", "Epsilon", "Zeta"),
                ("Eta", "Theta", "Iota"),
            ]),
        ):
            result = extract_psa_birth_row_text(crop_output())

        child = mapped_fields(result)["child_name"]
        self.assertEqual(child.components["first_name"], "Paddle")
        self.assertEqual(child.component_confidence["first_name"], 99.0)
        self.assertEqual(result.metrics["selected_engine_counts"], {"paddleocr": 9})

    def test_parallel_ensemble_accepts_engine_agreement(self):
        keys = sorted(crop_output().crops)
        component_values = {
            "child_name.first_name": "Alpha",
            "child_name.middle_name": "Beta",
            "child_name.last_name": "Gamma",
            "mother_maiden_name.first_name": "Delta",
            "mother_maiden_name.middle_name": "Epsilon",
            "mother_maiden_name.last_name": "Zeta",
            "father_name.first_name": "Eta",
            "father_name.middle_name": "Theta",
            "father_name.last_name": "Iota",
        }
        with patch(
            "extraction.psa_birth_row_ocr.recognize_birth_name_batch",
            return_value=tuple((component_values[key], 0.70) for key in keys),
        ), patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=row_data_reader([
                ("Alpha", "Beta", "Gamma"),
                ("Delta", "Epsilon", "Zeta"),
                ("Eta", "Theta", "Iota"),
            ]),
        ):
            result = extract_psa_birth_row_text(crop_output())

        self.assertTrue(result.success)
        self.assertEqual(
            result.metrics["selected_engine_counts"],
            {"paddleocr+tesseract_agreement": 9},
        )

    def test_noisy_low_confidence_name_is_returned_for_review(self):
        calls = 0

        def noisy_reader(image, **_kwargs):
            nonlocal calls
            calls += 1
            if calls > 3:
                return {"text": [], "conf": [], "left": [], "width": []}
            width = image.shape[1]
            return {
                "text": ["MARIA", "D.", "SARMIENT0"],
                "conf": [42.0, 37.0, 39.0],
                "left": [int(width * 0.08), int(width * 0.40), int(width * 0.76)],
                "width": [max(10, int(width * 0.08))] * 3,
            }

        with patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=noisy_reader,
        ):
            result = extract_psa_birth_row_text(crop_output())

        child = mapped_fields(result)["child_name"]
        self.assertEqual(child.components["last_name"], "SARMIENTO")
        self.assertLess(child.confidence, 50.0)
        self.assertIn("birth_name_low_confidence", child.issue_codes)

    def test_row_word_boxes_preserve_multiword_surname_order(self):
        def data_reader(image, **_kwargs):
            width = image.shape[1]
            return {
                "text": ["JUAN", "S.", "DELA", "CRUZ"],
                "conf": [96.0, 93.0, 91.0, 94.0],
                "left": [
                    int(width * 0.08),
                    int(width * 0.40),
                    int(width * 0.74),
                    int(width * 0.84),
                ],
                "width": [max(10, int(width * 0.07))] * 4,
            }

        with patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=data_reader,
        ):
            result = extract_psa_birth_row_text(crop_output())

        self.assertTrue(result.success)
        child = mapped_fields(result)["child_name"]
        self.assertEqual(child.components["last_name"], "DELA CRUZ")
        self.assertEqual(child.raw_text, "JUAN S. DELA CRUZ")

    def test_missing_binary_maps_to_field_failure(self):
        with patch(
            "extraction.psa_birth_row_ocr.pytesseract.image_to_data",
            side_effect=OCRBinaryUnavailableError("missing"),
        ):
            result = extract_psa_birth_row_text(crop_output())
        fields = mapped_fields(result)
        self.assertFalse(fields["child_name"].success)
        self.assertFalse(fields["mother_maiden_name"].success)
        self.assertTrue(
            all(not field.raw_text for field in result.data.fields)
        )

    def test_upstream_review_is_propagated(self):
        output = crop_output()
        wrapped = type(
            "Wrapped",
            (),
            {"data": output, "status": "review_required", "issues": []},
        )()
        result = extract_psa_birth_row_text(
            wrapped,
            ocr_reader=RecordingReader(valid_outputs()),
        )

        self.assertTrue(result.success)
        self.assertIn("REGISTRATION_REVIEW_PROPAGATED", issue_codes(result))

    def test_results_and_components_are_immutable(self):
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(valid_outputs()),
        )
        child = mapped_fields(result)["child_name"]
        with self.assertRaises(TypeError):
            child.components["first_name"] = "Changed"
        with self.assertRaises(Exception):
            child.raw_text = "Changed"

    def test_source_crops_are_not_mutated(self):
        output = crop_output()
        before = {
            key: value.copy() for key, value in output.crops.items()
        }
        extract_psa_birth_row_text(
            output,
            ocr_reader=RecordingReader(valid_outputs()),
        )
        for key, value in output.crops.items():
            np.testing.assert_array_equal(value, before[key])

    def test_metrics_are_private_and_review_is_always_required(self):
        values = valid_outputs()
        result = extract_psa_birth_row_text(
            crop_output(),
            ocr_reader=RecordingReader(values),
        )
        serialized = repr(dict(result.metrics))

        self.assertTrue(
            all(field.review_required for field in result.data.fields)
        )
        self.assertEqual(result.status, "review_required")
        self.assertIn("OCR_MANUAL_REVIEW_REQUIRED", issue_codes(result))
        for value in values:
            self.assertNotIn(value, serialized)

    def test_config_is_immutable_and_legacy_variant_is_normalized(self):
        config = PSABirthRowOCRConfig(
            preprocessing_variant="registered_name_cell_ocr"
        )
        self.assertEqual(config.preprocessing_variant, PREPROCESSING_VARIANT)
        with self.assertRaises(Exception):
            config.target_height = 10

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
        self.assertTrue(
            imported_roots.isdisjoint(
                {
                    "camera",
                    "job_worker",
                    "api",
                    "requests",
                    "backend",
                    "frontend",
                    "EasyOCR",
                    "PaddleOCR",
                    "parser",
                }
            )
        )


if __name__ == "__main__":
    unittest.main()
