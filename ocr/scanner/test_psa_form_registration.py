import ast
from dataclasses import FrozenInstanceError
from pathlib import Path
import unittest
from unittest.mock import patch

import cv2
import numpy as np

from extraction.psa_form_registration import (
    CALIBRATION_DEFAULTS,
    NormalizedPoint,
    PSAFormRegistrationConfig,
    _Candidate,
    _DetectedLine,
    _canonical_edge_status,
    _canonical_landmark_sequence_is_valid,
    _canonical_landmarks,
    _deduplicate_candidates,
    _intersection,
    _line_from_segment,
    _normalized_hough_segments,
    _order_corners,
    _repair_premature_bottom_boundary,
    _repair_premature_right_boundary,
    register_psa_birth_form,
    register_psa_birth_form_grid_envelope,
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


def extend_grid_bottom(corners, factor):
    unit = np.asarray(
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(
        unit,
        np.asarray(corners, dtype=np.float32),
    )
    extended = np.asarray(
        [[[0, 0], [1, 0], [1, factor], [0, factor]]],
        dtype=np.float32,
    )
    return cv2.perspectiveTransform(extended, transform).reshape(4, 2)


def horizontal_lines_for_positions(corners, positions):
    unit = np.asarray(
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(
        unit,
        np.asarray(corners, dtype=np.float32),
    )
    lines = []

    for position in positions:
        unit_points = np.asarray(
            [[[0.0, position], [1.0, position]]],
            dtype=np.float32,
        )
        source_points = cv2.perspectiveTransform(
            unit_points,
            transform,
        ).reshape(2, 2)
        x1, y1 = source_points[0]
        x2, y2 = source_points[1]
        a = float(y1 - y2)
        b = float(x2 - x1)
        c = float(x1 * y2 - x2 * y1)
        magnitude = float(np.hypot(a, b))
        lines.append(
            _DetectedLine(
                coefficients=(
                    a / magnitude,
                    b / magnitude,
                    c / magnitude,
                ),
                angle=0.0,
                strength=1000.0,
                position=position,
            )
        )

    return tuple(lines)


def extend_grid_right(corners, factor):
    unit = np.asarray(
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(
        unit,
        np.asarray(corners, dtype=np.float32),
    )
    extended = np.asarray(
        [[[0, 0], [factor, 0], [factor, 1], [0, 1]]],
        dtype=np.float32,
    )
    return cv2.perspectiveTransform(extended, transform).reshape(4, 2)


def rotate_corners(corners, degrees):
    center = corners.mean(axis=0)
    radians = np.deg2rad(degrees)
    rotation = np.asarray(
        [[np.cos(radians), -np.sin(radians)], [np.sin(radians), np.cos(radians)]],
        dtype=np.float32,
    )
    return (corners - center) @ rotation.T + center


class PSAFormRegistrationTest(unittest.TestCase):
    def test_metadata_homography_includes_the_canonical_second_warp(self):
        source = synthetic_grid()
        vertical = (0.1, 0.25, 0.5, 0.75, 0.9)
        horizontal = (
            0.05, 0.14, 0.22, 0.30, 0.408, 0.493, 0.58,
            0.66, 0.72, 0.794, 0.863, 0.91, 0.96,
        )
        inset = (0.03, 0.97, 0.03, 0.97, vertical, horizontal, 0.03)
        aligned = (0.0, 1.0, 0.0, 1.0, vertical, horizontal, 0.0)

        with patch(
            "extraction.psa_form_registration._canonical_landmarks",
            side_effect=(inset, aligned),
        ):
            result = register_psa_birth_form(source)

        self.assertTrue(result.success, result.issues)
        effective = np.asarray(
            result.data.transformation_metadata.homography,
            dtype=np.float64,
        ).reshape(3, 3)
        direct = cv2.warpPerspective(
            source,
            effective,
            (1400, 1375),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        difference = np.abs(
            direct.astype(np.float64)
            - result.data.registered_image.astype(np.float64)
        )
        self.assertLess(float(np.mean(difference)), 1.0)
        self.assertLessEqual(float(np.quantile(difference, 0.95)), 4.0)


    def test_hough_segments_accept_opencv_array_layouts(self):
        expected = np.asarray(
            [
                [10, 20, 30, 40],
                [50, 60, 70, 80],
            ],
            dtype=np.int32,
        )

        legacy_layout = expected.reshape(2, 1, 4)
        windows_layout = expected.reshape(2, 4)

        np.testing.assert_array_equal(
            _normalized_hough_segments(legacy_layout),
            expected,
        )
        np.testing.assert_array_equal(
            _normalized_hough_segments(windows_layout),
            expected,
        )

    def test_hough_segments_reject_malformed_arrays(self):
        malformed = np.asarray([1, 2, 3], dtype=np.int32)

        normalized = _normalized_hough_segments(malformed)

        self.assertEqual(normalized.shape, (0, 4))

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

    def test_grid_envelope_recovers_displaced_complete_psa_topology(self):
        translated = DEFAULT_CORNERS + np.asarray(
            [0.14 * (WIDTH - 1), 0],
            dtype=np.float32,
        )
        source = synthetic_grid(translated)

        station_result = register_psa_birth_form(source)
        result = register_psa_birth_form_grid_envelope(source)

        self.assertFalse(station_result.success)
        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertEqual(result.data.registered_image.shape[:2], (1375, 1400))
        self.assertIn("REGISTRATION_GRID_ENVELOPE_RECOVERY", issue_codes(result))
        self.assertGreaterEqual(
            result.metrics["postwarp_target_topology_score"],
            0.0,
        )
        self.assertLessEqual(
            result.metrics["maximum_canonical_edge_deviation"],
            PSAFormRegistrationConfig().review_canonical_edge_deviation,
        )

    def test_grid_envelope_rejects_incomplete_topology_before_coordinates(self):
        incomplete = synthetic_grid(
            horizontal=HORIZONTAL_LEVELS[:6],
            vertical=(0.0, 0.5, 1.0),
        )

        result = register_psa_birth_form_grid_envelope(incomplete)

        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertIn("FORM_GRID_ENVELOPE_TOPOLOGY_INVALID", issue_codes(result))

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

    def test_premature_bottom_boundary_is_extended_to_include_item_13(self):
        extended_corners = extend_grid_bottom(DEFAULT_CORNERS, 1.156771)
        horizontal = (
            0.0,
            0.0731,
            0.1476,
            0.2528,
            0.3490,
            0.4414,
            0.5302,
            0.6020,
            0.7012,
            0.7861,
            0.8645,
            0.9378,
            1.0,
        )

        result = register_psa_birth_form(
            synthetic_grid(extended_corners, horizontal=horizontal)
        )

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_TARGET_BOTTOM_EXTENDED", issue_codes(result))
        self.assertNotIn("TARGET_ROWS_OUTSIDE_FRAME", issue_codes(result))
        self.assertTrue(result.metrics["target_bottom_extended"])
        self.assertEqual(result.metrics["continuation_line_count"], 2)
        bottom_y = max(
            point.y
            for point in result.data.transformation_metadata.normalized_registration_corners
        )
        self.assertGreater(bottom_y, 0.68)

    def test_bottom_repair_accepts_aggregate_topology_improvement(self):
        positions = (
            -0.047227,
            0.0,
            0.054902,
            0.1438,
            0.234036,
            0.36137,
            0.477513,
            0.588436,
            0.694988,
            0.780883,
            0.899283,
            1.0,
            1.093236,
            1.18062,
        )
        candidate = _Candidate(
            corners=DEFAULT_CORNERS.astype(np.float64),
            score=0.818118,
            area_ratio=0.160849,
            aspect_ratio=1.271274,
            corner_deviation=0.092183,
            opposite_edge_ratio=1.014691,
            boundary_inferred=False,
        )

        repaired = _repair_premature_bottom_boundary(
            candidate,
            horizontal_lines_for_positions(DEFAULT_CORNERS, positions),
            PSAFormRegistrationConfig(),
            WIDTH,
            HEIGHT,
        )

        self.assertTrue(repaired.target_bottom_extended)
        self.assertEqual(repaired.continuation_line_count, 2)
        self.assertAlmostEqual(
            repaired.selected_bottom_continuation_position,
            1.18062,
            places=5,
        )
        self.assertEqual(
            repaired.bottom_continuation_acceptance_mode,
            "aggregate",
        )

    def test_single_continuation_line_fails_instead_of_truncating_item_13(self):
        extended_corners = extend_grid_bottom(DEFAULT_CORNERS, 1.084877)
        horizontal = (
            0.0,
            0.0781,
            0.1573,
            0.2697,
            0.3723,
            0.4709,
            0.5656,
            0.6423,
            0.7479,
            0.8386,
            0.9219,
            1.0,
        )

        result = register_psa_birth_form(
            synthetic_grid(extended_corners, horizontal=horizontal)
        )

        self.assertFalse(result.success)
        self.assertIn("TARGET_ROWS_OUTSIDE_FRAME", issue_codes(result))
        self.assertEqual(result.metrics["continuation_line_count"], 1)
        self.assertFalse(result.metrics["target_bottom_extended"])


    def test_premature_right_boundary_is_extended_for_last_name_cells(self):
        factor = 1.187902
        extended_corners = extend_grid_right(DEFAULT_CORNERS, factor)
        selected_frame_positions = (
            0.0,
            0.32,
            0.55,
            0.843,
            1.0,
            1.115241,
            factor,
        )
        vertical = tuple(
            position / factor
            for position in selected_frame_positions
        )

        result = register_psa_birth_form(
            synthetic_grid(extended_corners, vertical=vertical)
        )

        self.assertTrue(result.success, result.issues)
        self.assertEqual(result.status, "review_required")
        self.assertIn("FORM_TARGET_RIGHT_EXTENDED", issue_codes(result))
        self.assertNotIn("TARGET_COLUMNS_OUTSIDE_FRAME", issue_codes(result))
        self.assertTrue(result.metrics["target_right_extended"])
        self.assertEqual(result.metrics["right_continuation_line_count"], 2)
        self.assertGreater(result.metrics["prewarp_right_coverage"], 0.90)
        self.assertGreater(result.metrics["postcanonical_right_coverage"], 0.80)
        self.assertAlmostEqual(
            result.metrics["target_last_name_divider_position"],
            0.843,
            delta=0.045,
        )
        right_x = max(
            point.x
            for point in result.data.transformation_metadata.normalized_registration_corners
        )
        self.assertGreater(right_x, 0.70)

    def test_right_repair_preserves_existing_bottom_extension(self):
        normalized_corners = np.asarray(
            [
                [0.337066, 0.200807],
                [0.652348, 0.189965],
                [0.651655, 0.683011],
                [0.346798, 0.686771],
            ],
            dtype=np.float64,
        )
        corners = normalized_corners * np.asarray(
            [WIDTH - 1, HEIGHT - 1],
            dtype=np.float64,
        )
        candidate = _Candidate(
            corners=corners,
            score=0.829198,
            area_ratio=0.151677,
            aspect_ratio=0.844699,
            corner_deviation=0.075344,
            opposite_edge_ratio=1.034496,
            boundary_inferred=False,
            target_bottom_extended=True,
            continuation_line_count=2,
        )
        unit = np.asarray(
            [[0, 0], [1, 0], [1, 1], [0, 1]],
            dtype=np.float32,
        )
        source_to_unit = cv2.getPerspectiveTransform(
            corners.astype(np.float32),
            unit,
        )
        unit_to_source = np.linalg.inv(source_to_unit)
        positions = (
            -0.325509,
            -0.0,
            0.043003,
            0.126040,
            0.545988,
            0.592165,
            0.666424,
            0.831311,
            0.858252,
            0.903161,
            0.942454,
            0.963611,
            0.985413,
            1.014578,
            1.043701,
            1.115241,
            1.187902,
            1.223274,
            1.235353,
            1.255108,
        )
        vertical_lines = []

        for position in positions:
            unit_points = np.asarray(
                [[[position, 0.0], [position, 1.0]]],
                dtype=np.float32,
            )
            source_points = cv2.perspectiveTransform(
                unit_points,
                unit_to_source,
            ).reshape(2, 2)
            x1, y1 = source_points[0]
            x2, y2 = source_points[1]
            a = float(y1 - y2)
            b = float(x2 - x1)
            c = float(x1 * y2 - x2 * y1)
            magnitude = float(np.hypot(a, b))
            vertical_lines.append(
                _DetectedLine(
                    coefficients=(
                        a / magnitude,
                        b / magnitude,
                        c / magnitude,
                    ),
                    angle=90.0,
                    strength=1000.0,
                    position=position,
                )
            )

        repaired = _repair_premature_right_boundary(
            candidate,
            vertical_lines,
            PSAFormRegistrationConfig(),
            WIDTH,
            HEIGHT,
        )

        self.assertTrue(repaired.target_bottom_extended)
        self.assertEqual(repaired.continuation_line_count, 2)
        self.assertTrue(repaired.target_right_extended)
        self.assertEqual(repaired.right_continuation_line_count, 5)
        self.assertAlmostEqual(
            repaired.target_last_name_divider_position,
            0.796744,
            places=5,
        )
        self.assertAlmostEqual(
            repaired.selected_right_continuation_position,
            1.255108,
            places=6,
        )
        self.assertEqual(
            repaired.remaining_right_continuation_count,
            0,
        )
        normalized = repaired.corners / np.asarray(
            [WIDTH - 1, HEIGHT - 1],
            dtype=np.float64,
        )
        self.assertGreater(float(normalized[:, 0].max()), 0.70)

    def test_right_repair_rejects_premature_intermediate_continuation(self):
        factor = 1.255108
        extended_corners = extend_grid_right(DEFAULT_CORNERS, factor)
        selected_frame_positions = (
            0.0,
            0.32,
            0.55,
            0.843,
            1.0,
            1.115241,
            1.187902,
            1.223274,
            1.235353,
            factor,
        )
        vertical = tuple(
            position / factor
            for position in selected_frame_positions
        )

        result = register_psa_birth_form(
            synthetic_grid(extended_corners, vertical=vertical)
        )

        self.assertTrue(result.success, result.issues)
        self.assertIn(
            "FORM_TARGET_RIGHT_EXTENDED",
            issue_codes(result),
        )
        self.assertTrue(result.metrics["target_right_extended"])
        self.assertEqual(
            result.metrics["remaining_right_continuation_count"],
            0,
        )
        self.assertGreater(
            result.metrics["selected_right_continuation_position"],
            1.20,
        )
        self.assertLessEqual(
            result.metrics["maximum_canonical_edge_deviation"],
            0.020,
        )

    def test_single_right_continuation_line_fails_instead_of_clipping(self):
        factor = 1.115241
        extended_corners = extend_grid_right(DEFAULT_CORNERS, factor)
        selected_frame_positions = (
            0.0,
            0.32,
            0.55,
            0.843,
            1.0,
            factor,
        )
        vertical = tuple(
            position / factor
            for position in selected_frame_positions
        )

        result = register_psa_birth_form(
            synthetic_grid(extended_corners, vertical=vertical)
        )

        self.assertFalse(result.success)
        self.assertIn("TARGET_COLUMNS_OUTSIDE_FRAME", issue_codes(result))
        self.assertEqual(result.metrics["right_continuation_line_count"], 1)
        self.assertFalse(result.metrics["target_right_extended"])

    def test_normal_grid_does_not_require_right_extension(self):
        result = register_psa_birth_form(synthetic_grid())

        self.assertTrue(result.success, result.issues)
        self.assertFalse(result.metrics["target_right_extended"])
        self.assertEqual(result.metrics["right_continuation_line_count"], 0)
        self.assertNotIn("FORM_TARGET_RIGHT_EXTENDED", issue_codes(result))

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
