from __future__ import annotations

import ast
from pathlib import Path
import unittest

import numpy as np

from extraction.geometry import NormalizedBounds
from extraction.psa_birth_row_cropper import (
    PREPROCESSING_VARIANT,
    PSABirthRowCropperConfig,
    PSABirthRowCropperOutput,
    crop_psa_birth_name_rows,
)
from extraction.stage_result import StageResult


WIDTH = 1400
HEIGHT = 1375


def registered_image(fill: int = 240) -> np.ndarray:
    image = np.full((HEIGHT, WIDTH, 3), fill, dtype=np.uint8)
    image[:, :4] = 10
    image[:, -4:] = 20
    image[:4, :] = 30
    image[-4:, :] = 40
    return image


def issue_codes(result):
    return {issue["code"] for issue in result.issues}


def make_registration_metadata(status="success", issues=(), inferred=False):
    transformation = object()
    if inferred:
        issues = tuple(
            list(issues)
            + [
                {
                    "code": "REGISTRATION_BOUNDARY_INFERRED",
                    "stage": "psa_form_registration",
                    "field": "",
                }
            ]
        )
    return StageResult(
        stage="psa_form_registration",
        success=True,
        status=status,
        data=type(
            "RegistrationData",
            (),
            {"transformation_metadata": transformation},
        )(),
        issues=list(issues),
        metrics={},
    )


class PSABirthRowCropperTest(unittest.TestCase):
    def test_valid_registered_image_returns_three_regions(self):
        result = crop_psa_birth_name_rows(registered_image())

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "success")
        self.assertIsInstance(result.data, PSABirthRowCropperOutput)
        self.assertEqual(len(result.data.regions), 3)
        self.assertEqual(
            set(result.data.crops),
            {"child_name", "mother_maiden_name", "father_name"},
        )
        self.assertEqual(result.data.registered_width, WIDTH)
        self.assertEqual(result.data.registered_height, HEIGHT)

    def test_region_names_are_exact_and_ordered(self):
        result = crop_psa_birth_name_rows(registered_image())

        self.assertEqual(
            [region.name for region in result.data.regions],
            ["child_name", "mother_maiden_name", "father_name"],
        )

    def test_bounds_are_calibrated_name_cells_not_full_rows(self):
        result = crop_psa_birth_name_rows(registered_image())
        expected = {
            "child_name": NormalizedBounds(
                280 / WIDTH,
                41 / HEIGHT,
                1106 / WIDTH,
                50 / HEIGHT,
            ),
            "mother_maiden_name": NormalizedBounds(
                280 / WIDTH,
                614 / HEIGHT,
                1106 / WIDTH,
                59 / HEIGHT,
            ),
            "father_name": NormalizedBounds(
                280 / WIDTH,
                1137 / HEIGHT,
                1106 / WIDTH,
                47 / HEIGHT,
            ),
        }

        for region in result.data.regions:
            target = expected[region.name]
            self.assertAlmostEqual(region.bounds.x, target.x, places=6)
            self.assertAlmostEqual(region.bounds.y, target.y, places=6)
            self.assertAlmostEqual(region.bounds.width, target.width, places=6)
            self.assertAlmostEqual(region.bounds.height, target.height, places=6)
            self.assertLess(region.bounds.width, 1.0)

    def test_crop_dimensions_match_calibrated_cells(self):
        result = crop_psa_birth_name_rows(registered_image())

        self.assertEqual(result.data.crops["child_name"].shape[:2], (50, 1106))
        self.assertEqual(
            result.data.crops["mother_maiden_name"].shape[:2],
            (59, 1106),
        )
        self.assertEqual(result.data.crops["father_name"].shape[:2], (47, 1106))

    def test_default_crops_exclude_printed_headings_and_neighbor_rows(self):
        source = registered_image(fill=255)

        # Printed heading zones and next-row zones are deliberately dark.
        source[0:40, :] = 0
        source[92:170, :] = 0
        source[560:614, :] = 0
        source[674:760, :] = 0
        source[1080:1137, :] = 0
        source[1185:1260, :] = 0

        result = crop_psa_birth_name_rows(source)

        self.assertTrue(result.success, result.issues)
        self.assertTrue(
            all(float(np.mean(crop)) > 250.0 for crop in result.data.crops.values())
        )

    def test_preprocessing_variant_is_registered_name_cell(self):
        result = crop_psa_birth_name_rows(registered_image())
        self.assertTrue(
            all(
                region.preprocessing_variant == PREPROCESSING_VARIANT
                for region in result.data.regions
            )
        )
        self.assertFalse(result.metrics["full_row_crop_used"])

    def test_ocr_attempts_remain_zero(self):
        result = crop_psa_birth_name_rows(registered_image())
        self.assertTrue(all(region.ocr_attempts == 0 for region in result.data.regions))

    def test_none_input_fails(self):
        result = crop_psa_birth_name_rows(None)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTERED_IMAGE_INVALID"})

    def test_empty_input_fails(self):
        result = crop_psa_birth_name_rows(np.array([], dtype=np.uint8))
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTERED_IMAGE_INVALID"})

    def test_unsupported_image_rank_fails(self):
        result = crop_psa_birth_name_rows(np.zeros((10, 10, 2), dtype=np.uint8))
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTERED_IMAGE_INVALID"})

    def test_incorrect_registered_dimensions_fail(self):
        result = crop_psa_birth_name_rows(
            np.zeros((1375, 1399, 3), dtype=np.uint8)
        )
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTERED_DIMENSIONS_MISMATCH"})

    def test_invalid_metadata_fails_safely(self):
        result = crop_psa_birth_name_rows(
            registered_image(),
            registration_metadata=object(),
        )
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTRATION_METADATA_INVALID"})

    def test_mapping_configuration_is_supported(self):
        config = {
            "name_regions": {
                "child_name": {
                    "x": 0.1,
                    "y": 0.02,
                    "width": 0.8,
                    "height": 0.05,
                },
                "mother_maiden_name": {
                    "x": 0.1,
                    "y": 0.42,
                    "width": 0.8,
                    "height": 0.05,
                },
                "father_name": {
                    "x": 0.1,
                    "y": 0.8,
                    "width": 0.8,
                    "height": 0.05,
                },
            }
        }
        result = crop_psa_birth_name_rows(registered_image(), config=config)
        self.assertTrue(result.success, result.issues)


    def test_legacy_row_bands_configuration_remains_supported(self):
        config = PSABirthRowCropperConfig(
            row_bands=(
                ("child_name", 0.0, 0.1),
                ("mother_maiden_name", 0.4, 0.45),
                ("father_name", 0.8, 0.85),
            )
        )
        result = crop_psa_birth_name_rows(registered_image(), config=config)
        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.data.crops["child_name"].shape[1], WIDTH)

    def test_out_of_bounds_configuration_fails(self):
        config = {
            "name_regions": {
                "child_name": {
                    "x": 0.2,
                    "y": 0.0,
                    "width": 0.9,
                    "height": 0.1,
                },
                "mother_maiden_name": {
                    "x": 0.1,
                    "y": 0.4,
                    "width": 0.8,
                    "height": 0.05,
                },
                "father_name": {
                    "x": 0.1,
                    "y": 0.8,
                    "width": 0.8,
                    "height": 0.05,
                },
            }
        }
        result = crop_psa_birth_name_rows(registered_image(), config=config)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"TARGET_NAME_CELL_CROP_INVALID"})

    def test_zero_height_configuration_fails(self):
        with self.assertRaises(ValueError):
            PSABirthRowCropperConfig(
                name_regions=(
                    ("child_name", 0.1, 0.0, 0.8, 0.0),
                    ("mother_maiden_name", 0.1, 0.4, 0.8, 0.05),
                    ("father_name", 0.1, 0.8, 0.8, 0.05),
                )
            )

    def test_registration_review_state_propagates(self):
        metadata = make_registration_metadata(status="review_required")
        result = crop_psa_birth_name_rows(
            registered_image(),
            registration_metadata=metadata,
        )
        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("REGISTRATION_REVIEW_PROPAGATED", issue_codes(result))

    def test_review_propagation_can_be_disabled(self):
        metadata = make_registration_metadata(status="review_required")
        config = PSABirthRowCropperConfig(review_on_registration_issue=False)
        result = crop_psa_birth_name_rows(
            registered_image(),
            registration_metadata=metadata,
            config=config,
        )
        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "success")

    def test_inferred_registration_boundary_propagates(self):
        metadata = make_registration_metadata(status="success", inferred=True)
        result = crop_psa_birth_name_rows(
            registered_image(),
            registration_metadata=metadata,
        )
        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("REGISTRATION_BOUNDARY_INFERRED", issue_codes(result))

    def test_input_image_is_unchanged(self):
        source = registered_image()
        before = source.copy()
        crop_psa_birth_name_rows(source)
        np.testing.assert_array_equal(source, before)

    def test_crop_mutation_is_isolated(self):
        source = registered_image()
        first = crop_psa_birth_name_rows(source)
        second = crop_psa_birth_name_rows(source)

        for crop in first.data.crops.values():
            crop[:] = 0

        np.testing.assert_array_equal(source, registered_image())
        for name in second.data.crops:
            np.testing.assert_array_equal(
                second.data.crops[name],
                crop_psa_birth_name_rows(source).data.crops[name],
            )
            self.assertFalse(np.shares_memory(second.data.crops[name], source))

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path("extraction/psa_birth_row_cropper.py").read_text(
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
            "ocr",
            "camera",
            "job_worker",
            "api",
            "requests",
            "supabase",
            "backend",
            "frontend",
        }
        self.assertTrue(imported_roots.isdisjoint(forbidden))


if __name__ == "__main__":
    unittest.main()
