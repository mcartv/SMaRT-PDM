from __future__ import annotations

import ast
from pathlib import Path
import unittest

import numpy as np

from extraction.psa_birth_row_cropper import (
    PSABirthRowCropperConfig,
    PSABirthRowCropperOutput,
    crop_psa_birth_name_rows,
)
from extraction.models import RegionResult
from extraction.geometry import NormalizedBounds
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
        issues = tuple(list(issues) + [{"code": "REGISTRATION_BOUNDARY_INFERRED", "stage": "psa_form_registration", "field": ""}])
    return StageResult(
        stage="psa_form_registration",
        success=True,
        status=status,
        data=type("RegistrationData", (), {"transformation_metadata": transformation})(),
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
        self.assertEqual(set(result.data.crops), {"child_name", "mother_maiden_name", "father_name"})
        self.assertEqual(result.data.registered_width, WIDTH)
        self.assertEqual(result.data.registered_height, HEIGHT)

    def test_region_names_are_exact(self):
        result = crop_psa_birth_name_rows(registered_image())

        self.assertEqual([region.name for region in result.data.regions], ["child_name", "mother_maiden_name", "father_name"])

    def test_bounds_match_approved_bands_and_full_width(self):
        result = crop_psa_birth_name_rows(registered_image())
        expected = {
            "child_name": NormalizedBounds(0.0, 0.0, 1.0, 0.14036363636363636),
            "mother_maiden_name": NormalizedBounds(0.0, 0.408, 1.0, 0.08509090909090909),
            "father_name": NormalizedBounds(0.0, 0.7934545454545454, 1.0, 0.06981818181818182),
        }

        for region in result.data.regions:
            self.assertEqual(region.bounds.x, 0.0)
            self.assertEqual(region.bounds.width, 1.0)
            self.assertEqual(region.name, region.name)
            self.assertAlmostEqual(region.bounds.y, expected[region.name].y, places=6)
            self.assertAlmostEqual(region.bounds.height, expected[region.name].height, places=6)

    def test_crop_dimensions_use_documented_rounding_policy(self):
        result = crop_psa_birth_name_rows(registered_image())

        self.assertEqual(result.data.crops["child_name"].shape[:2], (193, 1400))
        self.assertEqual(result.data.crops["mother_maiden_name"].shape[:2], (117, 1400))
        self.assertEqual(result.data.crops["father_name"].shape[:2], (96, 1400))

    def test_preprocessing_variant_is_registered_whole_row(self):
        result = crop_psa_birth_name_rows(registered_image())
        self.assertTrue(all(region.preprocessing_variant == "registered_whole_row" for region in result.data.regions))

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
        result = crop_psa_birth_name_rows(np.zeros((1375, 1399, 3), dtype=np.uint8))
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTERED_DIMENSIONS_MISMATCH"})

    def test_invalid_metadata_fails_safely(self):
        result = crop_psa_birth_name_rows(registered_image(), registration_metadata=object())
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"REGISTRATION_METADATA_INVALID"})

    def test_out_of_bounds_configuration_fails(self):
        config = {
            "row_bands": {
                "child_name": {"x": 0.0, "y": 0.0, "width": 1.1, "height": 0.140},
                "mother_maiden_name": {"x": 0.0, "y": 0.408, "width": 1.0, "height": 0.085},
                "father_name": {"x": 0.0, "y": 0.794, "width": 1.0, "height": 0.069},
            }
        }
        result = crop_psa_birth_name_rows(registered_image(), config=config)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"TARGET_ROW_CROP_INVALID"})

    def test_empty_crop_fails(self):
        config = PSABirthRowCropperConfig(row_bands=(("child_name", 0.0, 0.0), ("mother_maiden_name", 0.408, 0.493), ("father_name", 0.794, 0.863)))
        result = crop_psa_birth_name_rows(registered_image(), config=config)
        self.assertFalse(result.success)
        self.assertEqual(issue_codes(result), {"TARGET_ROW_CROP_EMPTY"})

    def test_registration_review_state_propagates(self):
        metadata = make_registration_metadata(status="review_required")
        result = crop_psa_birth_name_rows(registered_image(), registration_metadata=metadata)
        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("REGISTRATION_REVIEW_PROPAGATED", issue_codes(result))

    def test_inferred_registration_boundary_propagates(self):
        metadata = make_registration_metadata(status="success", inferred=True)
        result = crop_psa_birth_name_rows(registered_image(), registration_metadata=metadata)
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

        child = first.data.crops["child_name"]
        mother = first.data.crops["mother_maiden_name"]
        father = first.data.crops["father_name"]
        child[:] = 0
        mother[:] = 1
        father[:] = 2

        np.testing.assert_array_equal(source, registered_image())
        np.testing.assert_array_equal(second.data.crops["child_name"], crop_psa_birth_name_rows(source).data.crops["child_name"])
        self.assertFalse(np.shares_memory(child, source))
        self.assertFalse(np.shares_memory(mother, source))
        self.assertFalse(np.shares_memory(father, source))
        self.assertFalse(np.shares_memory(child, mother))
        self.assertFalse(np.shares_memory(child, father))

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path("extraction/psa_birth_row_cropper.py").read_text(encoding="utf-8")
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
        forbidden = {"ocr", "camera", "job_worker", "api", "requests", "supabase", "backend", "frontend"}
        self.assertTrue(imported_roots.isdisjoint(forbidden))


if __name__ == "__main__":
    unittest.main()
