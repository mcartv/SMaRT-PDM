from __future__ import annotations

import ast
from pathlib import Path
import unittest
from unittest.mock import patch

import cv2
import numpy as np

from extraction.psa_birth_row_cropper import (
    COMPONENT_NAMES,
    FIELD_NAMES,
    GEOMETRY_ARTIFACT_VERSION,
    GEOMETRY_MODE,
    PREPROCESSING_VARIANT,
    CellGridMetrics,
    FixedNameRowGeometry,
    PSABirthRowCropperConfig,
    PSABirthRowCropperOutput,
    _measure_cell_grid_metrics,
    _remove_grid_lines,
    _validate_cell_geometry,
    crop_psa_birth_name_rows,
    validate_psa_birth_name_topology,
)
from extraction.stage_result import StageResult


WIDTH = 1400
HEIGHT = 1375
ROW_GEOMETRIES = (
    ("child_name", 358, 652, 963, 1248, 50, 104),
    ("mother_maiden_name", 321, 587, 923, 1211, 685, 732),
    ("father_name", 278, 580, 921, 1268, 1238, 1290),
)


def form_image() -> np.ndarray:
    image = np.full((HEIGHT, WIDTH, 3), 255, dtype=np.uint8)

    for (
        field_name,
        label_right,
        first_right,
        middle_right,
        last_right,
        value_top,
        value_bottom,
    ) in ROW_GEOMETRIES:
        del field_name
        border_top = max(0, value_top - 3)
        border_bottom = min(HEIGHT - 1, value_bottom + 3)

        cv2.line(
            image,
            (label_right, border_top),
            (last_right, border_top),
            (0, 0, 0),
            2,
        )
        cv2.line(
            image,
            (label_right, border_bottom),
            (last_right, border_bottom),
            (0, 0, 0),
            2,
        )
        for divider in (
            label_right,
            first_right,
            middle_right,
            last_right,
        ):
            cv2.line(
                image,
                (divider, border_top),
                (divider, border_bottom),
                (0, 0, 0),
                2,
            )

    return image


def issue_codes(result):
    return {issue["code"] for issue in result.issues}


def registration_metadata(status="success", issues=None):
    return StageResult(
        stage="psa_form_registration",
        success=True,
        status=status,
        data=type(
            "Data",
            (),
            {"transformation_metadata": object()},
        )(),
        issues=list(issues or []),
        metrics={},
    )


class PSABirthRowCropperTest(unittest.TestCase):
    def test_detects_nine_ordered_name_cells(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "success")
        self.assertIsInstance(result.data, PSABirthRowCropperOutput)
        expected = [
            f"{field}.{component}"
            for field in FIELD_NAMES
            for component in COMPONENT_NAMES
        ]
        self.assertEqual(
            [region.name for region in result.data.regions],
            expected,
        )
        self.assertEqual(list(result.data.crops), expected)
        self.assertEqual(result.metrics["cell_crop_count"], 9)

    def test_default_geometry_matches_accepted_artifact(self):
        config = PSABirthRowCropperConfig()

        self.assertEqual(config.row_geometries, ROW_GEOMETRIES)
        self.assertEqual(config.internal_padding_pixels, 4)
        self.assertEqual(config.vertical_inset_pixels, 1)

    def test_fixed_row_geometry_component_boundaries(self):
        row = FixedNameRowGeometry(*ROW_GEOMETRIES[0])

        self.assertEqual(
            row.component_boundaries,
            (
                ("first_name", 358, 652),
                ("middle_name", 652, 963),
                ("last_name", 963, 1248),
            ),
        )

    def test_each_row_uses_independent_columns(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertTrue(result.success, result.issues)
        self.assertEqual(
            result.metrics["per_row_column_boundaries"],
            {
                "child_name": (358, 652, 963, 1248),
                "mother_maiden_name": (321, 587, 923, 1211),
                "father_name": (278, 580, 921, 1268),
            },
        )

    def test_each_row_uses_independent_value_band(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertTrue(result.success, result.issues)
        self.assertEqual(
            result.metrics["per_row_value_bands"],
            {
                "child_name": (50, 104),
                "mother_maiden_name": (685, 732),
                "father_name": (1238, 1290),
            },
        )

    def test_cell_dimensions_match_fixed_geometry_and_insets(self):
        result = crop_psa_birth_name_rows(form_image())

        expected_shapes = {
            "child_name.first_name": (52, 286),
            "child_name.middle_name": (52, 303),
            "child_name.last_name": (52, 277),
            "mother_maiden_name.first_name": (45, 258),
            "mother_maiden_name.middle_name": (45, 328),
            "mother_maiden_name.last_name": (45, 280),
            "father_name.first_name": (50, 294),
            "father_name.middle_name": (50, 333),
            "father_name.last_name": (50, 339),
        }

        self.assertEqual(
            {
                name: crop.shape[:2]
                for name, crop in result.data.crops.items()
            },
            expected_shapes,
        )

    def test_sibling_cells_share_identical_vertical_bounds(self):
        result = crop_psa_birth_name_rows(form_image())

        for field_name in FIELD_NAMES:
            regions = [
                region
                for region in result.data.regions
                if region.name.startswith(f"{field_name}.")
            ]
            self.assertEqual(len(regions), 3)
            self.assertEqual(
                len({region.bounds.y for region in regions}),
                1,
            )
            self.assertEqual(
                len({region.bounds.height for region in regions}),
                1,
            )

    def test_child_bounds_are_exact(self):
        result = crop_psa_birth_name_rows(form_image())
        region = result.data.regions[0]

        self.assertEqual(region.bounds.x, 362 / WIDTH)
        self.assertEqual(region.bounds.y, 51 / HEIGHT)
        self.assertEqual(region.bounds.width, 286 / WIDTH)
        self.assertEqual(region.bounds.height, 52 / HEIGHT)

    def test_mother_bounds_are_exact(self):
        result = crop_psa_birth_name_rows(form_image())
        region = next(
            item
            for item in result.data.regions
            if item.name == "mother_maiden_name.middle_name"
        )

        self.assertEqual(region.bounds.x, 591 / WIDTH)
        self.assertEqual(region.bounds.y, 686 / HEIGHT)
        self.assertEqual(region.bounds.width, 328 / WIDTH)
        self.assertEqual(region.bounds.height, 45 / HEIGHT)

    def test_father_bounds_are_exact(self):
        result = crop_psa_birth_name_rows(form_image())
        region = next(
            item
            for item in result.data.regions
            if item.name == "father_name.last_name"
        )

        self.assertEqual(region.bounds.x, 925 / WIDTH)
        self.assertEqual(region.bounds.y, 1239 / HEIGHT)
        self.assertEqual(region.bounds.width, 339 / WIDTH)
        self.assertEqual(region.bounds.height, 50 / HEIGHT)

    def test_heading_content_is_excluded(self):
        source = form_image()
        for row in ROW_GEOMETRIES:
            label_right, last_right = row[1], row[4]
            value_top = row[5]
            source[
                max(0, value_top - 25):value_top,
                label_right:last_right,
            ] = 0

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(float(np.mean(crop)) > 245.0 for crop in result.data.crops.values())
        )

    def test_neighboring_row_content_is_excluded(self):
        source = form_image()
        for row in ROW_GEOMETRIES:
            label_right, last_right = row[1], row[4]
            value_bottom = row[6]
            source[
                value_bottom:value_bottom + 20,
                label_right:last_right,
            ] = 0

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(float(np.mean(crop)) > 245.0 for crop in result.data.crops.values())
        )

    def test_label_region_is_excluded_for_each_row(self):
        source = form_image()
        for row in ROW_GEOMETRIES:
            label_right = row[1]
            top, bottom = row[5], row[6]
            source[top:bottom, :label_right] = (255, 0, 0)

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(crop.ndim == 2 for crop in result.data.crops.values())
        )
        self.assertTrue(
            all(float(np.mean(crop)) > 245.0 for crop in result.data.crops.values())
        )

    def test_right_image_edge_is_excluded(self):
        source = form_image()
        source[:, 1399:1400] = (0, 0, 255)

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(
                region.bounds.x + region.bounds.width
                <= 1395 / WIDTH
                for region in result.data.regions
            )
        )

    def test_father_not_applicable_mark_remains_inside_first_cell(self):
        source = form_image()
        cv2.putText(
            source,
            "N/A",
            (500, 1273),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 0),
            2,
        )

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        father_first = result.data.crops["father_name.first_name"]
        self.assertLess(float(np.mean(father_first)), 254.0)

    def test_blank_middle_cell_remains_valid(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertTrue(result.success, result.issues)
        self.assertIn("child_name.middle_name", result.data.crops)
        self.assertGreater(
            float(np.mean(result.data.crops["child_name.middle_name"])),
            245.0,
        )

    def test_topology_refinement_ignores_unrelated_page_lines(self):
        source = form_image()
        cv2.line(source, (0, 300), (1399, 300), (0, 0, 0), 4)
        cv2.line(source, (200, 0), (200, 1374), (0, 0, 0), 4)

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            result.metrics["dynamic_geometry_repositioning_used"]
        )
        self.assertEqual(result.metrics["topology_status"], "matched")
        self.assertEqual(
            result.metrics["child_name_value_top"],
            50,
        )

    def test_geometry_artifact_metrics_are_locked(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertEqual(
            result.metrics["geometry_artifact_version"],
            GEOMETRY_ARTIFACT_VERSION,
        )
        self.assertEqual(result.metrics["geometry_mode"], GEOMETRY_MODE)
        self.assertEqual(
            result.metrics["geometry_source"],
            "validated_private_visual_calibration",
        )

    def test_all_output_crops_are_independent_grayscale_arrays(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(
                isinstance(crop, np.ndarray)
                and crop.dtype == np.uint8
                and crop.ndim == 2
                for crop in result.data.crops.values()
            )
        )

    def test_preprocessing_variant_and_attempts_are_locked(self):
        result = crop_psa_birth_name_rows(form_image())

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(
                region.preprocessing_variant == PREPROCESSING_VARIANT
                and region.ocr_attempts == 0
                and region.confidence == 1.0
                for region in result.data.regions
            )
        )

    def test_grid_line_cleanup_removes_long_lines(self):
        cell = np.full((60, 300), 255, dtype=np.uint8)
        cv2.line(cell, (0, 10), (299, 10), 0, 2)
        cv2.line(cell, (20, 0), (20, 59), 0, 2)

        cleaned = _remove_grid_lines(cell)

        self.assertGreater(float(np.mean(cleaned[8:13, :])), 245.0)
        self.assertGreater(float(np.mean(cleaned[:, 18:23])), 245.0)

    def test_grid_line_cleanup_preserves_short_thin_strokes(self):
        cell = np.full((60, 300), 255, dtype=np.uint8)
        cv2.line(cell, (100, 15), (100, 45), 0, 1)
        cv2.line(cell, (90, 15), (110, 15), 0, 1)

        cleaned = _remove_grid_lines(cell)

        self.assertLess(float(np.mean(cleaned[14:46, 89:112])), 253.0)

    def test_dense_name_ink_is_not_persistent_grid(self):
        cell = np.full((60, 300), 255, dtype=np.uint8)
        cv2.putText(
            cell,
            "ALEXANDER",
            (8, 42),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            0,
            2,
        )
        cleaned = _remove_grid_lines(cell)
        metrics = _measure_cell_grid_metrics(
            cell,
            cleaned,
            field_name="child_name",
            component_name="first_name",
            horizontal_threshold=0.72,
            vertical_threshold=0.78,
            minimum_thickness=2,
        )

        self.assertFalse(metrics.contaminated)
        self.assertTrue(_validate_cell_geometry(cleaned, metrics=metrics))

    def test_persistent_horizontal_grid_requires_coverage_and_thickness(self):
        cell = np.full((60, 300), 255, dtype=np.uint8)
        cleaned = cell.copy()
        cv2.line(cleaned, (0, 20), (299, 20), 0, 3)
        metrics = _measure_cell_grid_metrics(
            cell,
            cleaned,
            field_name="child_name",
            component_name="first_name",
            horizontal_threshold=0.72,
            vertical_threshold=0.78,
            minimum_thickness=2,
        )

        self.assertTrue(metrics.contaminated)
        self.assertGreaterEqual(
            metrics.maximum_horizontal_thickness_after,
            2,
        )

    def test_single_pixel_horizontal_line_does_not_fail(self):
        cell = np.full((60, 300), 255, dtype=np.uint8)
        cv2.line(cell, (0, 20), (299, 20), 0, 1)
        metrics = _measure_cell_grid_metrics(
            cell,
            cell,
            field_name="child_name",
            component_name="first_name",
            horizontal_threshold=0.72,
            vertical_threshold=0.78,
            minimum_thickness=2,
        )

        self.assertFalse(metrics.contaminated)

    def test_persistent_vertical_grid_requires_coverage_and_thickness(self):
        cell = np.full((60, 300), 255, dtype=np.uint8)
        cleaned = cell.copy()
        cv2.line(cleaned, (40, 0), (40, 59), 0, 3)
        metrics = _measure_cell_grid_metrics(
            cell,
            cleaned,
            field_name="mother_maiden_name",
            component_name="middle_name",
            horizontal_threshold=0.72,
            vertical_threshold=0.78,
            minimum_thickness=2,
        )

        self.assertTrue(metrics.contaminated)
        self.assertGreaterEqual(
            metrics.maximum_vertical_thickness_after,
            2,
        )

    def test_contaminated_cell_geometry_fails_safely(self):
        source = form_image()
        fake_metrics = CellGridMetrics(
            field_name="mother_maiden_name",
            component_name="middle_name",
            width=447,
            height=39,
            horizontal_coverage_before=1.0,
            horizontal_coverage_after=1.0,
            vertical_coverage_before=0.0,
            vertical_coverage_after=0.0,
            maximum_horizontal_thickness_before=3,
            maximum_horizontal_thickness_after=3,
            maximum_vertical_thickness_before=0,
            maximum_vertical_thickness_after=0,
            contaminated=True,
        )

        with patch(
            "extraction.psa_birth_row_cropper._measure_cell_grid_metrics",
            return_value=fake_metrics,
        ):
            result = crop_psa_birth_name_rows(source)

        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"birth_name_cell_grid_contaminated"},
        )
        self.assertEqual(
            result.issues[0]["component"],
            "first_name",
        )
        self.assertIn(
            "failed_cell_grid_metrics",
            result.metrics,
        )

    def test_success_metrics_include_nine_grid_records(self):
        result = crop_psa_birth_name_rows(form_image())

        records = result.metrics["cell_grid_metrics"]
        self.assertEqual(len(records), 9)
        self.assertEqual(
            set(records),
            {
                f"{field}.{component}"
                for field in FIELD_NAMES
                for component in COMPONENT_NAMES
            },
        )
        self.assertTrue(
            all(record["contaminated"] is False for record in records.values())
        )

    def test_registration_review_is_propagated(self):
        result = crop_psa_birth_name_rows(
            form_image(),
            registration_metadata=registration_metadata(
                status="review_required",
                issues=[
                    {
                        "code": "FORM_TARGET_BOTTOM_EXTENDED",
                        "stage": "psa_form_registration",
                        "field": "",
                    }
                ],
            ),
        )

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn(
            "REGISTRATION_REVIEW_PROPAGATED",
            issue_codes(result),
        )
        self.assertTrue(
            result.metrics["registration_review_propagated"]
        )

    def test_registration_review_can_be_disabled(self):
        result = crop_psa_birth_name_rows(
            form_image(),
            registration_metadata=registration_metadata(
                status="review_required"
            ),
            config=PSABirthRowCropperConfig(
                review_on_registration_issue=False
            ),
        )

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "success")

    def test_invalid_input_fails(self):
        result = crop_psa_birth_name_rows(None)

        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"REGISTERED_IMAGE_INVALID"},
        )

    def test_invalid_dimensions_fail(self):
        result = crop_psa_birth_name_rows(
            np.zeros((100, 100, 3), dtype=np.uint8)
        )

        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"REGISTERED_DIMENSIONS_MISMATCH"},
        )

    def test_invalid_metadata_fails(self):
        result = crop_psa_birth_name_rows(
            form_image(),
            registration_metadata=object(),
        )

        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"REGISTRATION_METADATA_INVALID"},
        )

    def test_unknown_config_key_fails_safely(self):
        result = crop_psa_birth_name_rows(
            form_image(),
            config={"unsupported": True},
        )

        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"TARGET_NAME_CELL_CROP_INVALID"},
        )

    def test_invalid_row_order_is_rejected_by_config(self):
        rows = list(ROW_GEOMETRIES)
        rows[0], rows[1] = rows[1], rows[0]

        with self.assertRaises(ValueError):
            PSABirthRowCropperConfig(row_geometries=tuple(rows))

    def test_invalid_column_order_is_rejected_by_config(self):
        rows = list(ROW_GEOMETRIES)
        rows[0] = (
            "child_name",
            358,
            300,
            963,
            1248,
            50,
            104,
        )

        with self.assertRaises(ValueError):
            PSABirthRowCropperConfig(row_geometries=tuple(rows))

    def test_invalid_value_band_is_rejected_by_config(self):
        rows = list(ROW_GEOMETRIES)
        rows[2] = (
            "father_name",
            278,
            580,
            921,
            1268,
            1290,
            1238,
        )

        with self.assertRaises(ValueError):
            PSABirthRowCropperConfig(row_geometries=tuple(rows))

    def test_too_small_cell_fails_with_item_code(self):
        rows = list(ROW_GEOMETRIES)
        rows[1] = (
            "mother_maiden_name",
            321,
            400,
            923,
            1211,
            685,
            732,
        )
        result = crop_psa_birth_name_rows(
            form_image(),
            config=PSABirthRowCropperConfig(
                row_geometries=tuple(rows)
            ),
        )

        self.assertFalse(result.success)
        self.assertEqual(
            issue_codes(result),
            {"birth_item_6_value_band_invalid"},
        )

    def test_missing_required_item_boundary_uses_calibrated_review_fallback(self):
        source = form_image()
        cv2.rectangle(
            source,
            (923 - 8, 685 - 32),
            (923 + 8, 732 + 32),
            (255, 255, 255),
            -1,
        )

        topology = validate_psa_birth_name_topology(source)
        result = crop_psa_birth_name_rows(source)

        self.assertTrue(topology.success)
        self.assertEqual(topology.status, "review_required")
        self.assertEqual(
            issue_codes(topology),
            {"BIRTH_NAME_ROW_TOPOLOGY_WEAK"},
        )
        self.assertTrue(result.success)
        self.assertEqual(result.metrics["topology_status"], "matched")

    def test_validated_topology_refines_shifted_component_boundaries(self):
        shifted_rows = tuple(
            (
                name,
                left + 12,
                first + 12,
                middle + 12,
                right + 12,
                top,
                bottom,
            )
            for name, left, first, middle, right, top, bottom in ROW_GEOMETRIES
        )
        source = np.full((HEIGHT, WIDTH, 3), 255, dtype=np.uint8)
        for _name, left, first, middle, right, value_top, value_bottom in shifted_rows:
            top = value_top - 3
            bottom = value_bottom + 3
            cv2.line(source, (left, top), (right, top), (0, 0, 0), 2)
            cv2.line(source, (left, bottom), (right, bottom), (0, 0, 0), 2)
            for divider in (left, first, middle, right):
                cv2.line(source, (divider, top), (divider, bottom), (0, 0, 0), 2)

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertEqual(
            result.metrics["per_row_column_boundaries"]["child_name"],
            (370, 664, 975, 1260),
        )

    def test_invalid_grid_thresholds_are_rejected(self):
        with self.assertRaises(ValueError):
            PSABirthRowCropperConfig(
                persistent_horizontal_grid_coverage=0.0
            )
        with self.assertRaises(ValueError):
            PSABirthRowCropperConfig(
                persistent_vertical_grid_coverage=1.1
            )

    def test_config_is_immutable(self):
        config = PSABirthRowCropperConfig()

        with self.assertRaises(Exception):
            config.internal_padding_pixels = 9

    def test_source_and_sibling_crops_are_independent(self):
        source = form_image()
        result = crop_psa_birth_name_rows(source)
        first = result.data.crops["child_name.first_name"]
        middle = result.data.crops["child_name.middle_name"]

        first[:, :] = 0

        self.assertGreater(float(np.mean(middle)), 245.0)
        self.assertGreater(float(np.mean(source)), 240.0)

    def test_metrics_contain_geometry_only(self):
        result = crop_psa_birth_name_rows(form_image())
        serialized = repr(result.metrics).lower()

        for forbidden in (
            "raw_text",
            "ocr_text",
            "first_name_value",
            "middle_name_value",
            "last_name_value",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path(
            "extraction/psa_birth_row_cropper.py"
        ).read_text(encoding="utf-8")
        tree = ast.parse(source)
        imported = set()

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                imported.add(node.module or "")

        self.assertFalse(
            any(
                name.startswith(
                    (
                        "pytesseract",
                        "paddleocr",
                        "easyocr",
                        "requests",
                        "socket",
                    )
                )
                for name in imported
            )
        )


if __name__ == "__main__":
    unittest.main()
