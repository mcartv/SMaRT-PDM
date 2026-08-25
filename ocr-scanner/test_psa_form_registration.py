import ast
from dataclasses import FrozenInstanceError
from pathlib import Path
import unittest

import cv2
import numpy as np

from extraction.psa_form_registration import (
    CALIBRATION_DEFAULTS,
    NormalizedPoint,
    PSAFormRegistrationConfig,
    _Candidate,
    _canonical_edge_status,
    _canonical_landmark_sequence_is_valid,
    _canonical_landmarks,
    _deduplicate_candidates,
    _intersection,
    _line_from_segment,
    _order_corners,
    register_psa_birth_form,
)


WIDTH = 2592
HEIGHT = 1944
DEFAULT_CORNERS = np.asarray(
    [
        [0.341071 * (WIDTH - 1), 0.189424 * (HEIGHT - 1)],
        [0.649873 * (WIDTH - 1), 0.190910 * (HEIGHT - 1)],
        [0.653759 * (WIDTH - 1), 0.621344 * (HEIGHT - 1)],
        [0.310172 * (WIDTH - 1), 0.611427 * (HEIGHT - 1)],
    ],
    dtype=np.float32,
)
HORIZONTAL_LEVELS = (0.0, 0.14, 0.22, 0.30, 0.408, 0.493, 0.58, 0.66, 0.72, 0.794, 0.863, 0.91, 0.96, 1.0)
VERTICAL_LEVELS = (0.0, 0.25, 0.5, 0.75, 1.0)


def synthetic_grid(corners=DEFAULT_CORNERS, horizontal=HORIZONTAL_LEVELS, vertical=VERTICAL_LEVELS):
    image = np.full((HEIGHT, WIDTH, 3), 244, dtype=np.uint8)
    unit = np.asarray([[0, 0], [1000, 0], [1000, 1000], [0, 1000]], dtype=np.float32)
    transform = cv2.getPerspectiveTransform(unit, np.asarray(corners, dtype=np.float32))

    def project(x, y):
        point = np.asarray([[[x * 1000, y * 1000]]], dtype=np.float32)
        return tuple(np.rint(cv2.perspectiveTransform(point, transform)[0, 0]).astype(int))

    for y in horizontal:
        cv2.line(image, project(0, y), project(1, y), (20, 20, 20), 7, cv2.LINE_AA)
    for x in vertical:
        cv2.line(image, project(x, 0), project(x, 1), (20, 20, 20), 7, cv2.LINE_AA)
    return image


def issue_codes(result):
    return {issue["code"] for issue in result.issues}


def rotate_corners(corners, degrees):
    center = corners.mean(axis=0)
    radians = np.deg2rad(degrees)
    rotation = np.asarray(
        [[np.cos(radians), -np.sin(radians)], [np.sin(radians), np.cos(radians)]],
        dtype=np.float32,
    )
    return (corners - center) @ rotation.T + center


class PSAFormRegistrationTest(unittest.TestCase):
    def test_invalid_and_undersized_sources_fail_safely(self):
        invalid = register_psa_birth_form("not-an-image")
        small = register_psa_birth_form(np.zeros((100, 100), dtype=np.uint8))

        self.assertFalse(invalid.success)
        self.assertEqual(issue_codes(invalid), {"INVALID_SOURCE_IMAGE"})
        self.assertFalse(small.success)
        self.assertEqual(issue_codes(small), {"SOURCE_IMAGE_TOO_SMALL"})
        self.assertIsNone(invalid.data)

    def test_invalid_configuration_fails_safely(self):
        for config in ({"output_width": 0}, {"output_width": 1000}, {"output_height": 1000}):
            with self.subTest(config=config):
                result = register_psa_birth_form(synthetic_grid(), config)

                self.assertFalse(result.success)
                self.assertEqual(issue_codes(result), {"INVALID_REGISTRATION_CONFIG"})

    def test_defaults_are_immutable(self):
        config = PSAFormRegistrationConfig()

        with self.assertRaises(FrozenInstanceError):
            config.output_width = 1
        with self.assertRaises(TypeError):
            CALIBRATION_DEFAULTS["area_ratio"] = 1.0
        self.assertIsInstance(config.expected_corners, tuple)
        self.assertIsInstance(config.target_row_bands, tuple)

    def test_calibrated_grid_success_and_exact_output(self):
        result = register_psa_birth_form(synthetic_grid())

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "success")
        self.assertEqual(result.data.registered_image.shape, (1375, 1400, 3))
        metadata = result.data.transformation_metadata
        self.assertEqual(metadata.output_dimensions, (1400, 1375))
        self.assertEqual(len(metadata.normalized_registration_corners), 4)
        self.assertGreaterEqual(metadata.horizontal_line_count, 10)
        self.assertGreaterEqual(metadata.vertical_line_count, 4)
        self.assertLessEqual(metadata.maximum_canonical_edge_deviation, 0.010)
        self.assertAlmostEqual(metadata.canonical_left_boundary, 0.0, places=2)
        self.assertAlmostEqual(metadata.canonical_top_boundary, 0.0, places=2)
        self.assertAlmostEqual(metadata.canonical_right_boundary, 1.0, places=2)
        self.assertAlmostEqual(metadata.canonical_bottom_boundary, 1.0, places=2)
        self.assertGreaterEqual(len(metadata.canonical_vertical_landmarks), 3)
        self.assertGreaterEqual(len(metadata.canonical_horizontal_landmarks), 3)

    def test_shuffled_corner_ordering_is_stable(self):
        shuffled = DEFAULT_CORNERS[[2, 0, 3, 1]]

        ordered = _order_corners(shuffled)

        np.testing.assert_allclose(ordered, DEFAULT_CORNERS, atol=0.01)

    def test_intersection_is_independent_of_line_order(self):
        horizontal = _line_from_segment((100, 200, 900, 210), WIDTH, HEIGHT)
        vertical = _line_from_segment((300, 50, 310, 900), WIDTH, HEIGHT)

        first = _intersection(horizontal, vertical)
        second = _intersection(vertical, horizontal)

        np.testing.assert_allclose(first, second, atol=1e-8)

    def test_perspective_is_corrected(self):
        result = register_psa_birth_form(synthetic_grid())

        self.assertTrue(result.success, result.issues)
        self.assertTrue(result.data.transformation_metadata.perspective_applied)
        output = result.data.registered_image
        dark = cv2.cvtColor(output, cv2.COLOR_BGR2GRAY) < 80
        self.assertGreater(float(dark[:, :12].mean()), 0.5)
        self.assertGreater(float(dark[:, -12:].mean()), 0.5)
        self.assertGreater(float(dark[:12, :].mean()), 0.5)
        self.assertGreater(float(dark[-12:, :].mean()), 0.5)

    def test_weak_horizontal_line_evidence_requires_review(self):
        levels = (0.0, 0.14, 0.408, 0.493, 0.65, 0.794, 0.863, 1.0)

        result = register_psa_birth_form(synthetic_grid(horizontal=levels))

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_LINE_EVIDENCE_WEAK", issue_codes(result))

    def test_weak_vertical_line_evidence_requires_review(self):
        result = register_psa_birth_form(synthetic_grid(vertical=(0.0, 0.5, 1.0)))

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_LINE_EVIDENCE_WEAK", issue_codes(result))

    def test_insufficient_line_evidence_fails(self):
        horizontal = (0.0, 0.14, 0.408, 0.493, 0.794, 1.0)

        result = register_psa_birth_form(synthetic_grid(horizontal=horizontal))

        self.assertFalse(result.success)
        self.assertIn("FORM_GRID_NOT_FOUND", issue_codes(result))
        self.assertIsNone(result.data)

    def test_one_missing_boundary_is_inferred_for_review(self):
        result = register_psa_birth_form(synthetic_grid(vertical=(0.0, 0.25, 0.5, 0.75)))

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_BOUNDARY_INFERRED", issue_codes(result))
        self.assertTrue(result.data.transformation_metadata.boundary_inferred)

    def test_corner_deviation_success_review_and_failure(self):
        for delta, expected_success, expected_status, code in (
            (0.015, True, "success", None),
            (0.030, True, "review_required", "FORM_POSITION_DEVIATION_ELEVATED"),
            (0.050, True, "review_required", "FORM_POSITION_DEVIATION_ELEVATED"),
            (0.075, False, "failed", "FORM_POSITION_OUTSIDE_CALIBRATION"),
        ):
            with self.subTest(delta=delta):
                shifted = DEFAULT_CORNERS + np.asarray([delta * (WIDTH - 1), 0], dtype=np.float32)
                result = register_psa_birth_form(synthetic_grid(shifted))
                self.assertEqual(result.success, expected_success)
                self.assertEqual(result.status, expected_status)
                if code:
                    self.assertIn(code, issue_codes(result))

    def test_translated_grid_remains_usable_when_fully_visible(self):
        translated = DEFAULT_CORNERS + np.asarray([-0.045 * (WIDTH - 1), 0], dtype=np.float32)

        result = register_psa_birth_form(synthetic_grid(translated))

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_POSITION_DEVIATION_ELEVATED", issue_codes(result))
        self.assertLessEqual(result.data.transformation_metadata.maximum_canonical_edge_deviation, 0.020)

    def test_grid_shifted_right_keeps_registered_target_bands(self):
        translated = DEFAULT_CORNERS + np.asarray([0.045 * (WIDTH - 1), 0], dtype=np.float32)

        result = register_psa_birth_form(synthetic_grid(translated))

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.data.registered_image.shape[:2], (1375, 1400))
        self.assertNotIn("TARGET_ROWS_OUTSIDE_FRAME", issue_codes(result))
        self.assertLessEqual(result.data.transformation_metadata.maximum_canonical_edge_deviation, 0.020)

    def test_four_degree_rotation_requires_position_review(self):
        result = register_psa_birth_form(synthetic_grid(rotate_corners(DEFAULT_CORNERS, 4.0)))

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_POSITION_DEVIATION_ELEVATED", issue_codes(result))

    def test_opposite_edge_ratio_success_review_and_failure(self):
        for ratio, expected_success, expected_status, code in (
            (1.14, True, "success", None),
            (1.20, True, "review_required", "FORM_PERSPECTIVE_ELEVATED"),
            (1.30, False, "failed", "FORM_PERSPECTIVE_EXCESSIVE"),
        ):
            with self.subTest(ratio=ratio):
                corners = DEFAULT_CORNERS.copy()
                center = float((corners[2, 0] + corners[3, 0]) / 2.0)
                top_width = float(np.linalg.norm(corners[1] - corners[0]))
                corners[3, 0] = center - top_width * ratio / 2.0
                corners[2, 0] = center + top_width * ratio / 2.0
                config = {
                    "expected_corners": tuple(NormalizedPoint(x / (WIDTH - 1), y / (HEIGHT - 1)) for x, y in corners)
                }
                result = register_psa_birth_form(synthetic_grid(corners), config)
                self.assertEqual(result.success, expected_success)
                self.assertEqual(result.status, expected_status)
                if code:
                    self.assertIn(code, issue_codes(result))

    def test_materially_different_similar_candidates_are_rejected(self):
        offset = np.asarray([0.050 * (WIDTH - 1), 0], dtype=np.float32)
        image = np.minimum(
            synthetic_grid(DEFAULT_CORNERS - offset),
            synthetic_grid(DEFAULT_CORNERS + offset),
        )

        result = register_psa_birth_form(image)

        self.assertFalse(result.success)
        self.assertIn("FORM_REGISTRATION_AMBIGUOUS", issue_codes(result))

    def test_overlapping_variant_candidates_collapse_to_one_cluster(self):
        config = PSAFormRegistrationConfig()
        base = _Candidate(DEFAULT_CORNERS.astype(np.float64), 0.9, 0.139, 1.018, 0.0, 1.11, False)
        duplicate = _Candidate(
            DEFAULT_CORNERS.astype(np.float64) + np.asarray([4.0, 2.0]),
            0.8,
            0.139,
            1.018,
            0.002,
            1.11,
            False,
        )

        clustered = _deduplicate_candidates((duplicate, base), config, WIDTH, HEIGHT)

        self.assertEqual(clustered, [base])

    def test_missing_target_row_boundaries_fails(self):
        levels = (0.0, 0.14, 0.22, 0.30, 0.408, 0.493, 0.58, 0.66, 0.72, 0.91, 0.94, 0.96, 0.98, 1.0)

        result = register_psa_birth_form(synthetic_grid(horizontal=levels))

        self.assertFalse(result.success)
        self.assertIn("TARGET_ROWS_OUTSIDE_FRAME", issue_codes(result))

    def test_canonical_edge_thresholds_cover_success_review_and_failure(self):
        config = PSAFormRegistrationConfig()
        self.assertEqual(_canonical_edge_status(0.005, config), "success")
        self.assertEqual(_canonical_edge_status(0.015, config), "review_required")
        self.assertEqual(_canonical_edge_status(0.030, config), "failed")

    def test_canonical_landmarks_are_immutable_and_ordered(self):
        result = register_psa_birth_form(synthetic_grid())

        metadata = result.data.transformation_metadata
        with self.assertRaises(AttributeError):
            metadata.canonical_left_boundary = 0.5
        self.assertTrue(
            _canonical_landmark_sequence_is_valid(
                metadata.canonical_vertical_landmarks,
                metadata.canonical_horizontal_landmarks,
            )
        )
        self.assertIsNone(_canonical_landmarks(np.zeros((10, 10, 3), dtype=np.uint8), PSAFormRegistrationConfig()))

    def test_invalid_landmark_ordering_fails(self):
        self.assertFalse(_canonical_landmark_sequence_is_valid((0.2, 0.1), (0.3, 0.4)))

    def test_output_and_source_mutation_are_isolated(self):
        source = synthetic_grid()
        before = source.copy()
        first = register_psa_birth_form(source)

        self.assertTrue(first.success, first.issues)
        np.testing.assert_array_equal(source, before)
        first.data.registered_image[:] = 0
        second = register_psa_birth_form(source)
        self.assertTrue(second.success, second.issues)
        self.assertTrue(np.any(second.data.registered_image != 0))
        np.testing.assert_array_equal(source, before)

    def test_homography_has_nine_finite_values(self):
        result = register_psa_birth_form(synthetic_grid())

        self.assertTrue(result.success, result.issues)
        homography = result.data.transformation_metadata.homography
        self.assertEqual(len(homography), 9)
        self.assertTrue(np.isfinite(homography).all())

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path("extraction/psa_form_registration.py").read_text(encoding="utf-8")
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
