import dataclasses
import inspect
import unittest
from unittest.mock import MagicMock, patch

import numpy as np

from extraction.grade_form_gwa_extraction import (
    GradeFormGWAConfig,
    extract_grade_form_gwa,
)


def positional_data(rows):
    columns = {
        "text": [],
        "conf": [],
        "left": [],
        "top": [],
        "width": [],
        "height": [],
        "block_num": [],
        "par_num": [],
        "line_num": [],
    }
    for row in rows:
        text, left, top, width, height = row[:5]
        confidence = row[5] if len(row) > 5 else 95
        line = row[6] if len(row) > 6 else 1
        values = {
            "text": text,
            "conf": confidence,
            "left": left,
            "top": top,
            "width": width,
            "height": height,
            "block_num": 1,
            "par_num": 1,
            "line_num": line,
        }
        for name, value in values.items():
            columns[name].append(value)
    return columns


def source_image():
    return np.full((1000, 800, 3), 255, dtype=np.uint8)


def label_rows(value="168"):
    rows = [
        ("Cumulative", 100, 500, 130, 28),
        ("GWA", 240, 500, 60, 28),
    ]
    if value is not None:
        rows.append((value, 340, 500, 60, 28))
    return rows


def variant_reader(values):
    if isinstance(values, str):
        mapping = {
            "grayscale": values,
            "otsu_threshold": values,
            "adaptive_threshold": values,
        }
    else:
        mapping = dict(values)

    reader = MagicMock(
        side_effect=lambda _image, variant, _config, _timeout: mapping.get(
            variant,
            "",
        )
    )
    return reader


class GradeFormGWAExtractionTest(unittest.TestCase):
    def test_direct_decimal_value_is_accepted_from_value_crop(self):
        crop_reader = variant_reader("1.68")

        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=crop_reader,
        )

        field = result.data.field
        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertEqual(field.field_name, "general_weighted_average")
        self.assertEqual(field.raw_text, "1.68")
        self.assertEqual(field.normalized_value, "1.68")
        self.assertEqual(field.value_source, "crop_ocr")
        self.assertFalse(field.normalization_applied)
        self.assertEqual(field.normalization_type, "none")
        self.assertTrue(field.decimal_evidence_detected)
        self.assertTrue(field.review_required)
        self.assertEqual(crop_reader.call_count, 3)

    def test_three_digits_with_matching_direct_decimal_are_recovered(self):
        crop_reader = variant_reader(
            {
                "grayscale": "168",
                "otsu_threshold": "1.68",
                "adaptive_threshold": "168",
            }
        )

        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=crop_reader,
        )

        field = result.data.field
        self.assertTrue(result.success)
        self.assertEqual(field.raw_text, "168")
        self.assertEqual(field.normalized_value, "1.68")
        self.assertEqual(
            field.value_source,
            "crop_ocr_decimal_recovery",
        )
        self.assertTrue(field.normalization_applied)
        self.assertEqual(
            field.normalization_type,
            "missing_decimal_recovered",
        )
        self.assertTrue(field.decimal_evidence_detected)
        self.assertEqual(field.issue_codes, ())

    @patch(
        "extraction.grade_form_gwa_extraction._decimal_component_detected",
        return_value=True,
    )
    def test_three_digits_with_component_evidence_are_recovered(self, evidence):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader("168"),
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.field.raw_text, "168")
        self.assertEqual(result.data.field.normalized_value, "1.68")
        self.assertTrue(result.data.field.decimal_evidence_detected)
        evidence.assert_called_once()

    @patch(
        "extraction.grade_form_gwa_extraction._decimal_component_detected",
        return_value=False,
    )
    def test_three_digits_without_decimal_evidence_are_rejected(self, evidence):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader("168"),
        )

        field = result.data.field
        self.assertFalse(result.success)
        self.assertIsNone(field.normalized_value)
        self.assertEqual(field.raw_text, "168")
        self.assertEqual(field.value_source, "crop_ocr_candidate")
        self.assertFalse(field.normalization_applied)
        self.assertFalse(field.decimal_evidence_detected)
        self.assertEqual(field.issue_codes, ("gwa_decimal_not_confirmed",))
        evidence.assert_called_once()

    @patch(
        "extraction.grade_form_gwa_extraction._decimal_component_detected",
        return_value=False,
    )
    def test_split_three_digit_observation_is_decimal_not_confirmed(self, evidence):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader("1 68"),
        )

        field = result.data.field
        self.assertFalse(result.success)
        self.assertIsNone(field.normalized_value)
        self.assertEqual(field.raw_text, "168")
        self.assertEqual(field.value_source, "crop_ocr_candidate")
        self.assertEqual(field.issue_codes, ("gwa_decimal_not_confirmed",))
        self.assertNotEqual(field.issue_codes, ("gwa_value_out_of_range",))
        evidence.assert_called_once()

    @patch(
        "extraction.grade_form_gwa_extraction._decimal_component_detected",
        return_value=True,
    )
    def test_split_three_digit_observation_with_image_evidence_is_recovered(
        self,
        evidence,
    ):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader("1 68"),
        )

        field = result.data.field
        self.assertTrue(result.success)
        self.assertEqual(field.raw_text, "168")
        self.assertEqual(field.normalized_value, "1.68")
        self.assertEqual(field.value_source, "crop_ocr_decimal_recovery")
        self.assertTrue(field.normalization_applied)
        self.assertTrue(field.decimal_evidence_detected)
        evidence.assert_called_once()

    @patch(
        "extraction.grade_form_gwa_extraction._decimal_component_detected",
        return_value=False,
    )
    def test_misplaced_decimal_three_digit_observation_is_not_out_of_range(
        self,
        evidence,
    ):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader("16.8"),
        )

        field = result.data.field
        self.assertFalse(result.success)
        self.assertIsNone(field.normalized_value)
        self.assertEqual(field.issue_codes, ("gwa_decimal_not_confirmed",))
        evidence.assert_called_once()

    def test_raw_three_digit_token_is_preserved_but_never_normalized_without_evidence(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader("168"),
        )

        self.assertIsNone(result.data.field.normalized_value)
        self.assertEqual(result.data.field.raw_text, "168")
        self.assertEqual(
            result.data.field.value_source,
            "crop_ocr_candidate",
        )
        self.assertEqual(
            result.data.field.issue_codes,
            ("gwa_decimal_not_confirmed",),
        )

    def test_two_different_normalized_candidates_are_source_conflict(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("168"))
            ),
            value_reader=variant_reader(
                {
                    "grayscale": "168",
                    "otsu_threshold": "1.75",
                    "adaptive_threshold": "1.68",
                }
            ),
        )

        self.assertFalse(result.success)
        self.assertEqual(
            result.data.field.issue_codes,
            ("gwa_source_conflict",),
        )

    def test_candidate_above_five_is_rejected(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("600"))
            ),
            value_reader=variant_reader("6.00"),
        )

        self.assertFalse(result.success)
        self.assertIsNone(result.data.field.normalized_value)
        self.assertEqual(
            result.data.field.issue_codes,
            ("gwa_value_out_of_range",),
        )

    def test_grading_system_numbers_outside_value_crop_are_ignored(self):
        rows = [
            ("1.25", 50, 200, 50, 25, 95, 1),
            ("Cumulative", 100, 600, 130, 25, 95, 2),
            ("GWA", 240, 600, 55, 25, 95, 2),
            ("168", 350, 600, 55, 25, 95, 2),
            ("5.00", 600, 800, 55, 25, 95, 3),
        ]

        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(return_value=positional_data(rows)),
            value_reader=variant_reader("1.68"),
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.field.normalized_value, "1.68")

    def test_value_without_approved_label_is_rejected_before_crop_ocr(self):
        crop_reader = variant_reader("1.68")
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("Subject", 100, 400, 90, 25),
                        ("168", 300, 400, 50, 25),
                    ]
                )
            ),
            value_reader=crop_reader,
        )

        self.assertFalse(result.success)
        self.assertEqual(
            result.data.field.issue_codes,
            ("gwa_label_not_found",),
        )
        crop_reader.assert_not_called()

    def test_each_approved_label_is_recognized(self):
        labels = (
            ("Cumulative GWA", ("Cumulative", "GWA")),
            ("GWA", ("GWA",)),
            ("General Weighted Average", ("General", "Weighted", "Average")),
            ("General Average", ("General", "Average")),
            ("Weighted Average", ("Weighted", "Average")),
        )
        for label_type, words in labels:
            with self.subTest(label=label_type):
                rows = []
                left = 80
                for word in words:
                    rows.append((word, left, 400, 90, 25))
                    left += 100
                rows.append(("175", left + 20, 400, 55, 25))
                result = extract_grade_form_gwa(
                    source_image(),
                    word_reader=MagicMock(
                        return_value=positional_data(rows)
                    ),
                    value_reader=variant_reader("1.75"),
                )
                self.assertTrue(result.success)
                self.assertEqual(result.data.field.label_type, label_type)

    def test_direct_positional_decimal_is_accepted_without_crop_ocr(self):
        crop_reader = variant_reader("9.99")
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("GWA", 100, 500, 60, 28, 95, 1),
                        ("1.68", 190, 500, 60, 28, 95, 1),
                    ]
                )
            ),
            value_reader=crop_reader,
        )

        field = result.data.field
        self.assertTrue(result.success)
        self.assertEqual(field.raw_text, "1.68")
        self.assertEqual(field.normalized_value, "1.68")
        self.assertEqual(field.value_source, "positional")
        self.assertEqual(field.label_type, "GWA")
        self.assertTrue(field.decimal_evidence_detected)
        crop_reader.assert_not_called()

    def test_valid_gwa_line_is_used_when_cumulative_gwa_line_is_blank(self):
        crop_reader = variant_reader("")
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("GWA", 100, 500, 60, 28, 95, 1),
                        ("1.68", 190, 500, 60, 28, 95, 1),
                        ("Cumulative", 100, 620, 130, 28, 95, 2),
                        ("GWA", 240, 620, 60, 28, 95, 2),
                    ]
                )
            ),
            value_reader=crop_reader,
        )

        field = result.data.field
        self.assertTrue(result.success)
        self.assertEqual(field.normalized_value, "1.68")
        self.assertEqual(field.value_source, "positional")
        self.assertEqual(field.label_type, "GWA")
        crop_reader.assert_not_called()

    def test_distinct_direct_positional_values_are_rejected(self):
        crop_reader = variant_reader("")
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("GWA", 100, 500, 60, 28, 95, 1),
                        ("1.68", 190, 500, 60, 28, 95, 1),
                        ("General", 100, 620, 80, 28, 95, 2),
                        ("Average", 190, 620, 100, 28, 95, 2),
                        ("2.50", 320, 620, 60, 28, 95, 2),
                    ]
                )
            ),
            value_reader=crop_reader,
        )

        self.assertFalse(result.success)
        self.assertEqual(
            result.data.field.issue_codes,
            ("gwa_source_conflict",),
        )
        crop_reader.assert_not_called()

    def test_specific_label_suppresses_unrelated_generic_gwa_heading(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("GWA", 620, 80, 55, 24, 95, 1),
                        ("SCORE", 680, 80, 75, 24, 95, 1),
                        ("Cumulative", 100, 620, 130, 28, 95, 2),
                        ("GWA", 240, 620, 60, 28, 95, 2),
                        ("250", 340, 620, 55, 28, 95, 2),
                    ]
                )
            ),
            value_reader=variant_reader("2.50"),
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.field.label_type, "Cumulative GWA")

    def test_multiple_specific_labels_remain_ambiguous(self):
        crop_reader = variant_reader("2.50")
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("Cumulative", 100, 400, 130, 28, 95, 1),
                        ("GWA", 240, 400, 60, 28, 95, 1),
                        ("Cumulative", 100, 700, 130, 28, 95, 2),
                        ("GWA", 240, 700, 60, 28, 95, 2),
                    ]
                )
            ),
            value_reader=crop_reader,
        )

        self.assertFalse(result.success)
        self.assertEqual(
            result.data.field.issue_codes,
            ("gwa_value_ambiguous",),
        )
        crop_reader.assert_not_called()

    def test_failed_candidate_contains_only_numeric_crop_observation(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("123"))
            ),
            value_reader=variant_reader("candidate=123 private"),
        )

        field = result.data.field
        self.assertFalse(field.success)
        self.assertEqual(field.raw_text, "123")
        self.assertIsNone(field.normalized_value)
        self.assertEqual(field.value_source, "crop_ocr_candidate")
        self.assertNotIn("private", field.raw_text)

    def test_all_three_bounded_preprocessing_variants_are_used(self):
        crop_reader = variant_reader("2.50")
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("250"))
            ),
            value_reader=crop_reader,
        )

        self.assertTrue(result.success)
        variants = [call.args[1] for call in crop_reader.call_args_list]
        self.assertEqual(
            variants,
            ["grayscale", "otsu_threshold", "adaptive_threshold"],
        )
        for call in crop_reader.call_args_list:
            crop = call.args[0]
            self.assertLess(crop.shape[0], source_image().shape[0])
            self.assertLess(crop.shape[1], source_image().shape[1])

    def test_timeout_is_review_only_and_does_not_escape(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                side_effect=RuntimeError("private engine detail")
            ),
        )

        self.assertFalse(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertEqual(result.data.field.issue_codes, ("gwa_ocr_timeout",))
        self.assertNotIn("private", str(result.issues))

    def test_input_image_is_not_mutated(self):
        image = source_image()
        before = image.copy()
        extract_grade_form_gwa(
            image,
            word_reader=MagicMock(
                return_value=positional_data(label_rows("250"))
            ),
            value_reader=variant_reader("2.50"),
        )
        np.testing.assert_array_equal(image, before)

    def test_output_dataclasses_are_immutable(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(label_rows("250"))
            ),
            value_reader=variant_reader("2.50"),
        )

        with self.assertRaises(dataclasses.FrozenInstanceError):
            result.data.field.raw_text = "changed"

    def test_metrics_contain_no_gwa_value_or_page_text(self):
        result = extract_grade_form_gwa(
            source_image(),
            word_reader=MagicMock(
                return_value=positional_data(
                    [
                        ("Synthetic", 50, 200, 90, 25),
                        *label_rows("250"),
                    ]
                )
            ),
            value_reader=variant_reader("2.50"),
        )

        serialized = str(result.metrics)
        self.assertNotIn("2.50", serialized)
        self.assertNotIn("Synthetic", serialized)
        self.assertLessEqual(result.metrics["ocr_attempt_count"], 4)
        self.assertLessEqual(
            GradeFormGWAConfig().total_timeout_seconds,
            15.0,
        )

    def test_numeric_whitelist_includes_zero_for_valid_scale_endpoints(self):
        source = inspect.getsource(
            __import__(
                "extraction.grade_form_gwa_extraction",
                fromlist=["_default_value_reader"],
            )._default_value_reader
        )
        self.assertIn("0123456789.", source)


if __name__ == "__main__":
    unittest.main()
