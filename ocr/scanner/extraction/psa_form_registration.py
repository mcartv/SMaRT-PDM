from __future__ import annotations

import math
from dataclasses import dataclass, field, fields, replace
from numbers import Real
from types import MappingProxyType
from typing import Any, Mapping, Optional, Sequence

import cv2
import numpy as np

from .stage_result import StageResult


STAGE_NAME = "psa_form_registration"


@dataclass(frozen=True)
class NormalizedPoint:
    x: float
    y: float

    def __post_init__(self) -> None:
        for name, value in (("x", self.x), ("y", self.y)):
            if isinstance(value, bool) or not isinstance(value, Real):
                raise ValueError(f"{name} must be numeric")
            if not math.isfinite(value) or not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be finite and between 0.0 and 1.0")


def _default_corners() -> tuple[NormalizedPoint, ...]:
    return (
        NormalizedPoint(0.341071, 0.189424),
        NormalizedPoint(0.649873, 0.190910),
        NormalizedPoint(0.653759, 0.621344),
        NormalizedPoint(0.310172, 0.611427),
    )


def _default_row_bands() -> tuple[tuple[str, float, float], ...]:
    return (
        ("item_1", 0.000, 0.140),
        ("item_6", 0.408, 0.493),
        ("item_13", 0.794, 0.863),
    )


@dataclass(frozen=True)
class PSAFormRegistrationConfig:
    output_width: int = 1400
    output_height: int = 1375
    minimum_source_width: int = 640
    minimum_source_height: int = 480
    expected_corners: tuple[NormalizedPoint, ...] = field(default_factory=_default_corners)
    expected_area_ratio: float = 0.139107
    expected_aspect_ratio: float = 1.018127
    expected_horizontal_lines: int = 14
    expected_vertical_lines: int = 5
    target_row_bands: tuple[tuple[str, float, float], ...] = field(default_factory=_default_row_bands)
    success_horizontal_lines: int = 10
    review_horizontal_lines: int = 7
    success_vertical_lines: int = 4
    review_vertical_lines: int = 3
    success_corner_deviation: float = 0.020
    review_corner_deviation: float = 0.070
    success_opposite_edge_ratio: float = 1.15
    review_opposite_edge_ratio: float = 1.25
    success_canonical_edge_deviation: float = 0.010
    review_canonical_edge_deviation: float = 0.020
    minimum_canonical_vertical_landmarks: int = 3
    minimum_canonical_horizontal_landmarks: int = 3
    boundary_search_distance: float = 0.090
    line_cluster_distance: float = 0.006
    line_angle_tolerance_degrees: float = 12.0
    row_topology_tolerance: float = 0.060
    ambiguity_score_gap: float = 0.050
    ambiguity_corner_distance: float = 0.012
    minimum_contrast_standard_deviation: float = 12.0
    minimum_laplacian_variance: float = 18.0
    continuation_search_limit: float = 1.25
    continuation_minimum_offset: float = 0.04
    continuation_improvement_margin: float = 0.012
    continuation_mean_improvement_margin: float = 0.004
    continuation_maximum_residual_improvement_margin: float = 0.004
    continuation_terminal_regression_tolerance: float = 0.004
    right_continuation_search_limit: float = 1.30
    right_continuation_minimum_offset: float = 0.05
    right_continuation_improvement_margin: float = 0.030
    right_continuation_clearance_ratio: float = 0.012
    target_last_name_divider_position: float = 0.843
    target_last_name_divider_tolerance: float = 0.045
    registered_line_minimum_coverage: float = 0.22
    maximum_extended_corner_deviation: float = 0.10

    def __post_init__(self) -> None:
        integer_fields = (
            "output_width",
            "output_height",
            "minimum_source_width",
            "minimum_source_height",
            "expected_horizontal_lines",
            "expected_vertical_lines",
            "success_horizontal_lines",
            "review_horizontal_lines",
            "success_vertical_lines",
            "review_vertical_lines",
        )
        for name in integer_fields:
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise ValueError(f"{name} must be a positive integer")
        if self.output_width != 1400 or self.output_height != 1375:
            raise ValueError("output dimensions must remain at the canonical 1400 by 1375")

        numeric_fields = (
            "expected_area_ratio",
            "expected_aspect_ratio",
            "success_corner_deviation",
            "review_corner_deviation",
            "success_opposite_edge_ratio",
            "review_opposite_edge_ratio",
            "success_canonical_edge_deviation",
            "review_canonical_edge_deviation",
            "boundary_search_distance",
            "line_cluster_distance",
            "line_angle_tolerance_degrees",
            "row_topology_tolerance",
            "ambiguity_score_gap",
            "ambiguity_corner_distance",
            "minimum_contrast_standard_deviation",
            "minimum_laplacian_variance",
            "continuation_search_limit",
            "continuation_minimum_offset",
            "continuation_improvement_margin",
            "continuation_mean_improvement_margin",
            "continuation_maximum_residual_improvement_margin",
            "continuation_terminal_regression_tolerance",
            "right_continuation_search_limit",
            "right_continuation_minimum_offset",
            "right_continuation_improvement_margin",
            "right_continuation_clearance_ratio",
            "target_last_name_divider_position",
            "target_last_name_divider_tolerance",
            "registered_line_minimum_coverage",
            "maximum_extended_corner_deviation",
        )
        for name in numeric_fields:
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, Real):
                raise ValueError(f"{name} must be numeric")
            if not math.isfinite(value) or value <= 0.0:
                raise ValueError(f"{name} must be finite and positive")

        if len(self.expected_corners) != 4 or not all(
            isinstance(point, NormalizedPoint) for point in self.expected_corners
        ):
            raise ValueError("expected_corners must contain four NormalizedPoint values")
        if self.review_horizontal_lines > self.success_horizontal_lines:
            raise ValueError("review_horizontal_lines must not exceed success_horizontal_lines")
        if self.review_vertical_lines > self.success_vertical_lines:
            raise ValueError("review_vertical_lines must not exceed success_vertical_lines")
        if self.success_corner_deviation >= self.review_corner_deviation:
            raise ValueError("corner deviation thresholds are not ordered")
        if self.success_opposite_edge_ratio >= self.review_opposite_edge_ratio:
            raise ValueError("opposite-edge thresholds are not ordered")
        if self.success_canonical_edge_deviation >= self.review_canonical_edge_deviation:
            raise ValueError("canonical edge thresholds are not ordered")
        if not 0.0 < self.expected_area_ratio < 1.0:
            raise ValueError("expected_area_ratio must be between 0.0 and 1.0")
        if not 0.0 < self.line_angle_tolerance_degrees < 45.0:
            raise ValueError("line_angle_tolerance_degrees must be below 45 degrees")
        if not 1.0 < self.continuation_search_limit <= 1.5:
            raise ValueError("continuation_search_limit must be above 1.0 and at most 1.5")
        if not 0.0 < self.continuation_minimum_offset < 0.25:
            raise ValueError("continuation_minimum_offset must be below 0.25")
        if not 0.0 < self.continuation_improvement_margin < self.row_topology_tolerance:
            raise ValueError("continuation_improvement_margin must be below row_topology_tolerance")
        if not 0.0 < self.continuation_mean_improvement_margin < self.row_topology_tolerance:
            raise ValueError(
                "continuation_mean_improvement_margin must be below row_topology_tolerance"
            )
        if not (
            0.0
            < self.continuation_maximum_residual_improvement_margin
            < self.row_topology_tolerance
        ):
            raise ValueError(
                "continuation_maximum_residual_improvement_margin must be below "
                "row_topology_tolerance"
            )
        if not 0.0 < self.continuation_terminal_regression_tolerance < self.row_topology_tolerance:
            raise ValueError(
                "continuation_terminal_regression_tolerance must be below row_topology_tolerance"
            )
        if not 1.0 < self.right_continuation_search_limit <= 1.5:
            raise ValueError(
                "right_continuation_search_limit must be above 1.0 and at most 1.5"
            )
        if not 0.0 < self.right_continuation_minimum_offset < 0.25:
            raise ValueError("right_continuation_minimum_offset must be below 0.25")
        if not 0.0 < self.right_continuation_improvement_margin < 0.25:
            raise ValueError("right_continuation_improvement_margin must be below 0.25")
        if not 0.0 < self.right_continuation_clearance_ratio < 0.10:
            raise ValueError("right_continuation_clearance_ratio must be below 0.10")
        if not 0.5 < self.target_last_name_divider_position < 0.95:
            raise ValueError(
                "target_last_name_divider_position must be between 0.5 and 0.95"
            )
        if not 0.0 < self.target_last_name_divider_tolerance < 0.15:
            raise ValueError("target_last_name_divider_tolerance must be below 0.15")
        if not 0.0 < self.registered_line_minimum_coverage < 1.0:
            raise ValueError("registered_line_minimum_coverage must be between 0.0 and 1.0")
        if not self.review_corner_deviation < self.maximum_extended_corner_deviation <= 0.15:
            raise ValueError(
                "maximum_extended_corner_deviation must exceed review_corner_deviation and be at most 0.15"
            )

        copied_bands = tuple(tuple(item) for item in self.target_row_bands)
        names: set[str] = set()
        for item in copied_bands:
            if len(item) != 3:
                raise ValueError("each target row band must contain name, top, and bottom")
            name, top, bottom = item
            if not isinstance(name, str) or not name or name in names:
                raise ValueError("target row names must be unique non-empty strings")
            names.add(name)
            if any(
                isinstance(value, bool)
                or not isinstance(value, Real)
                or not math.isfinite(value)
                for value in (top, bottom)
            ):
                raise ValueError("target row bounds must be finite numbers")
            if not 0.0 <= top < bottom <= 1.0:
                raise ValueError("target row bounds must be ordered within 0.0 and 1.0")
        object.__setattr__(self, "expected_corners", tuple(self.expected_corners))
        object.__setattr__(self, "target_row_bands", copied_bands)


@dataclass(frozen=True)
class PSAFormTransformationMetadata:
    source_dimensions: tuple[int, int]
    output_dimensions: tuple[int, int]
    normalized_registration_corners: tuple[NormalizedPoint, ...]
    homography: tuple[float, ...]
    horizontal_line_count: int
    vertical_line_count: int
    intersection_count: int
    candidate_count: int
    candidate_score: float
    registration_area_ratio: float
    aspect_ratio: float
    maximum_corner_deviation: float
    opposite_edge_ratio: float
    maximum_canonical_edge_deviation: float
    canonical_left_boundary: float
    canonical_right_boundary: float
    canonical_top_boundary: float
    canonical_bottom_boundary: float
    canonical_vertical_landmarks: tuple[float, ...]
    canonical_horizontal_landmarks: tuple[float, ...]
    perspective_applied: bool
    boundary_inferred: bool


@dataclass(frozen=True)
class PSAFormRegistrationOutput:
    registered_image: np.ndarray
    transformation_metadata: PSAFormTransformationMetadata


@dataclass(frozen=True)
class _DetectedLine:
    coefficients: tuple[float, float, float]
    angle: float
    strength: float
    position: float

    @property
    def array(self) -> np.ndarray:
        return np.asarray(self.coefficients, dtype=np.float64)


@dataclass(frozen=True)
class _Candidate:
    corners: np.ndarray
    score: float
    area_ratio: float
    aspect_ratio: float
    corner_deviation: float
    opposite_edge_ratio: float
    boundary_inferred: bool
    target_bottom_extended: bool = False
    continuation_line_count: int = 0
    selected_bottom_continuation_position: float = 1.0
    bottom_continuation_acceptance_mode: str = "none"
    target_right_extended: bool = False
    right_continuation_line_count: int = 0
    target_last_name_divider_position: float = 1.0
    selected_right_continuation_position: float = 1.0
    remaining_right_continuation_count: int = 0


@dataclass(frozen=True)
class _RightCoverageEvidence:
    divider_position: float
    residual: float
    score: float
    covered: bool


@dataclass(frozen=True)
class _RowTopologyEvidence:
    positions: tuple[float, ...]
    assigned: tuple[float, ...]
    residuals: tuple[float, ...]
    score: float
    covered: bool
    mean_residual: float
    terminal_residual: float


def _issue(code: str) -> dict[str, str]:
    return {"code": code, "stage": STAGE_NAME, "field": ""}


def _failure(code: str, **metrics: Any) -> StageResult[PSAFormRegistrationOutput]:
    return StageResult(
        stage=STAGE_NAME,
        success=False,
        status="failed",
        data=None,
        issues=[_issue(code)],
        metrics=dict(metrics),
    )


def _coerce_point(value: Any) -> NormalizedPoint:
    if isinstance(value, NormalizedPoint):
        return value
    if isinstance(value, Mapping):
        return NormalizedPoint(value["x"], value["y"])
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)) and len(value) == 2:
        return NormalizedPoint(value[0], value[1])
    raise ValueError("corner values must be NormalizedPoint, mapping, or coordinate pair")


def _build_config(config: PSAFormRegistrationConfig | Mapping[str, Any] | None) -> PSAFormRegistrationConfig:
    if config is None:
        return PSAFormRegistrationConfig()
    if isinstance(config, PSAFormRegistrationConfig):
        return replace(config)
    if not isinstance(config, Mapping):
        raise ValueError("config must be PSAFormRegistrationConfig, a mapping, or None")

    allowed = {item.name for item in fields(PSAFormRegistrationConfig)}
    unknown = set(config) - allowed
    if unknown:
        raise ValueError(f"unsupported configuration keys: {sorted(unknown)}")
    values = dict(config)
    if "expected_corners" in values:
        values["expected_corners"] = tuple(_coerce_point(item) for item in values["expected_corners"])
    if "target_row_bands" in values:
        bands = values["target_row_bands"]
        if isinstance(bands, Mapping):
            bands = tuple((name, bounds[0], bounds[1]) for name, bounds in bands.items())
        values["target_row_bands"] = tuple(tuple(item) for item in bands)
    return PSAFormRegistrationConfig(**values)


def _prepare_source(raw_image: Any) -> Optional[np.ndarray]:
    if not isinstance(raw_image, np.ndarray) or raw_image.dtype != np.uint8:
        return None
    if raw_image.ndim == 2:
        return raw_image
    if raw_image.ndim == 3 and raw_image.shape[2] in (3, 4):
        return raw_image
    return None


def _variants(source: np.ndarray) -> tuple[np.ndarray, ...]:
    if source.ndim == 2:
        gray = source.copy()
    elif source.shape[2] == 4:
        gray = cv2.cvtColor(source, cv2.COLOR_BGRA2GRAY)
    else:
        gray = cv2.cvtColor(source, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    threshold = cv2.adaptiveThreshold(
        clahe,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        41,
        12,
    )
    edges = cv2.Canny(cv2.GaussianBlur(clahe, (5, 5), 0), 45, 140)
    height, width = gray.shape
    horizontal_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (max(31, int(round(width * 0.045))), 1)
    )
    vertical_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (1, max(31, int(round(height * 0.060))))
    )
    horizontal = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, vertical_kernel)
    return gray, clahe, threshold, edges, horizontal, vertical


def _normalized_hough_segments(segments: np.ndarray) -> np.ndarray:
    array = np.asarray(segments)
    if array.size == 0 or array.size % 4 != 0:
        return np.empty((0, 4), dtype=np.float64)
    return array.reshape(-1, 4)


def _line_from_segment(segment: Sequence[int], width: int, height: int) -> Optional[_DetectedLine]:
    x1, y1, x2, y2 = (float(value) for value in segment)
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length <= 0.0:
        return None
    a, b, c = dy, -dx, dx * y1 - dy * x1
    scale = math.hypot(a, b)
    a, b, c = a / scale, b / scale, c / scale
    angle = math.degrees(math.atan2(dy, dx)) % 180.0
    center_x, center_y = (width - 1) / 2.0, (height - 1) / 2.0
    if angle <= 45.0 or angle >= 135.0:
        if abs(b) < 1e-8:
            return None
        position = (-(a * center_x + c) / b) / max(height - 1, 1)
    else:
        if abs(a) < 1e-8:
            return None
        position = (-(b * center_y + c) / a) / max(width - 1, 1)
    return _DetectedLine((a, b, c), angle, length, float(position))


def _angle_difference(first: float, second: float) -> float:
    difference = abs(first - second) % 180.0
    return min(difference, 180.0 - difference)


def _cluster_lines(
    lines: Sequence[_DetectedLine], config: PSAFormRegistrationConfig
) -> list[_DetectedLine]:
    groups: list[list[_DetectedLine]] = []
    for line in sorted(lines, key=lambda item: item.position):
        matching = next(
            (
                group
                for group in groups
                if abs(line.position - np.average(
                    [item.position for item in group],
                    weights=[item.strength for item in group],
                ))
                <= config.line_cluster_distance
                and _angle_difference(line.angle, group[0].angle) <= 3.0
            ),
            None,
        )
        if matching is None:
            groups.append([line])
        else:
            matching.append(line)

    clustered: list[_DetectedLine] = []
    for group in groups:
        strongest = max(group, key=lambda item: item.strength)
        clustered.append(
            _DetectedLine(
                strongest.coefficients,
                strongest.angle,
                sum(item.strength for item in group),
                float(
                    np.average(
                        [item.position for item in group],
                        weights=[item.strength for item in group],
                    )
                ),
            )
        )
    return clustered


def _morphology_lines(
    mask: np.ndarray,
    orientation: str,
    width: int,
    height: int,
    config: PSAFormRegistrationConfig,
) -> list[_DetectedLine]:
    expected = np.asarray([[point.x, point.y] for point in config.expected_corners], dtype=np.float64)
    minimum_x = max(0.0, float(expected[:, 0].min()) - config.boundary_search_distance)
    maximum_x = min(1.0, float(expected[:, 0].max()) + config.boundary_search_distance)
    minimum_y = max(0.0, float(expected[:, 1].min()) - config.boundary_search_distance)
    maximum_y = min(1.0, float(expected[:, 1].max()) + config.boundary_search_distance)
    detected: list[_DetectedLine] = []
    contours = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
    for contour in contours:
        x, y, box_width, box_height = cv2.boundingRect(contour)
        if orientation == "horizontal":
            if box_width < width * 0.18:
                continue
            vx, vy, x0, y0 = cv2.fitLine(contour, cv2.DIST_L2, 0, 0.01, 0.01).flatten()
            if abs(vx) < 1e-8:
                continue
            first_x, second_x = float(x), float(x + box_width - 1)
            segment = (
                first_x,
                float(y0 + (first_x - x0) * vy / vx),
                second_x,
                float(y0 + (second_x - x0) * vy / vx),
            )
        else:
            if box_height < height * 0.15:
                continue
            vx, vy, x0, y0 = cv2.fitLine(contour, cv2.DIST_L2, 0, 0.01, 0.01).flatten()
            if abs(vy) < 1e-8:
                continue
            first_y, second_y = float(y), float(y + box_height - 1)
            segment = (
                float(x0 + (first_y - y0) * vx / vy),
                first_y,
                float(x0 + (second_y - y0) * vx / vy),
                second_y,
            )
        line = _line_from_segment(segment, width, height)
        if line is None:
            continue
        if orientation == "horizontal" and minimum_y <= line.position <= maximum_y:
            detected.append(line)
        elif orientation == "vertical" and minimum_x <= line.position <= maximum_x:
            detected.append(line)
    return detected


def _detect_lines(
    edges: np.ndarray,
    horizontal_mask: np.ndarray,
    vertical_mask: np.ndarray,
    width: int,
    height: int,
    config: PSAFormRegistrationConfig,
) -> tuple[list[_DetectedLine], list[_DetectedLine]]:
    segments = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 1800.0,
        threshold=max(45, int(round(min(width, height) * 0.045))),
        minLineLength=max(80, int(round(min(width, height) * 0.10))),
        maxLineGap=max(12, int(round(min(width, height) * 0.025))),
    )
    horizontal = _morphology_lines(horizontal_mask, "horizontal", width, height, config)
    vertical = _morphology_lines(vertical_mask, "vertical", width, height, config)
    if segments is None:
        return _cluster_lines(horizontal, config), _cluster_lines(vertical, config)

    tolerance = config.line_angle_tolerance_degrees
    expected = np.asarray([[point.x, point.y] for point in config.expected_corners], dtype=np.float64)
    horizontal_minimum = width * 0.22
    vertical_minimum = height * 0.25
    minimum_x = max(0.0, float(expected[:, 0].min()) - config.boundary_search_distance)
    maximum_x = min(1.0, float(expected[:, 0].max()) + config.boundary_search_distance)
    minimum_y = max(0.0, float(expected[:, 1].min()) - config.boundary_search_distance)
    maximum_y = min(1.0, float(expected[:, 1].max()) + config.boundary_search_distance)
    supplement_horizontal = len(horizontal) < config.review_horizontal_lines
    for segment in _normalized_hough_segments(segments):
        line = _line_from_segment(segment, width, height)
        if line is None:
            continue
        horizontal_delta = min(line.angle, 180.0 - line.angle)
        vertical_delta = abs(line.angle - 90.0)
        if (
            supplement_horizontal
            and horizontal_delta <= tolerance
            and line.strength >= horizontal_minimum
            and minimum_y <= line.position <= maximum_y
        ):
            horizontal.append(line)
        elif (
            vertical_delta <= tolerance
            and line.strength >= vertical_minimum
            and minimum_x <= line.position <= maximum_x
        ):
            vertical.append(line)
    return _cluster_lines(horizontal, config), _cluster_lines(vertical, config)


def _point_line_distance(point: np.ndarray, line: _DetectedLine, diagonal: float) -> float:
    return abs(float(np.dot(line.array[:2], point) + line.array[2])) / diagonal


def _expected_pixels(config: PSAFormRegistrationConfig, width: int, height: int) -> np.ndarray:
    return np.asarray(
        [[point.x * (width - 1), point.y * (height - 1)] for point in config.expected_corners],
        dtype=np.float64,
    )


def _expected_boundary(points: np.ndarray, first: int, second: int, width: int, height: int) -> _DetectedLine:
    segment = (*points[first], *points[second])
    line = _line_from_segment(segment, width, height)
    if line is None:
        raise ValueError("expected boundary is invalid")
    return line


def _boundary_options(
    detected: Sequence[_DetectedLine],
    expected: _DetectedLine,
    expected_points: Sequence[np.ndarray],
    diagonal: float,
    config: PSAFormRegistrationConfig,
) -> list[_DetectedLine]:
    augmented = list(detected)
    pair_limit = config.line_cluster_distance * 2.5
    ordered = sorted(detected, key=lambda item: item.position)
    for index, first in enumerate(ordered):
        for second in ordered[index + 1 :]:
            separation = second.position - first.position
            if separation > pair_limit:
                break
            if not first.position <= expected.position <= second.position:
                continue
            if _angle_difference(first.angle, second.angle) > 3.0:
                continue
            first_coefficients = first.array
            second_coefficients = second.array
            if float(np.dot(first_coefficients[:2], second_coefficients[:2])) < 0.0:
                second_coefficients = -second_coefficients
            coefficients = (first_coefficients + second_coefficients) / 2.0
            norm = float(np.linalg.norm(coefficients[:2]))
            if norm <= 1e-8:
                continue
            coefficients /= norm
            angle = math.degrees(math.atan2(coefficients[0], -coefficients[1])) % 180.0
            augmented.append(
                _DetectedLine(
                    tuple(float(value) for value in coefficients),
                    angle,
                    first.strength + second.strength,
                    (first.position + second.position) / 2.0,
                )
            )

    ranked = []
    for line in augmented:
        distance = max(_point_line_distance(point, line, diagonal) for point in expected_points)
        angle = _angle_difference(line.angle, expected.angle) / 180.0
        if distance <= config.boundary_search_distance and angle <= 0.08:
            ranked.append((distance + angle, line))
    return [line for _, line in sorted(ranked, key=lambda item: item[0])[:3]]


def _intersection(first: _DetectedLine, second: _DetectedLine) -> Optional[np.ndarray]:
    point = np.cross(first.array, second.array)
    if not np.isfinite(point).all() or abs(point[2]) < 1e-8:
        return None
    return point[:2] / point[2]


def _order_corners(points: Sequence[Sequence[float]]) -> np.ndarray:
    array = np.asarray(points, dtype=np.float64)
    if array.shape != (4, 2) or not np.isfinite(array).all():
        raise ValueError("four finite corner points are required")
    center = array.mean(axis=0)
    ordered = array[np.argsort(np.arctan2(array[:, 1] - center[1], array[:, 0] - center[0]))]
    start = int(np.argmin(ordered.sum(axis=1)))
    ordered = np.roll(ordered, -start, axis=0)
    if ordered[1, 0] < ordered[-1, 0]:
        ordered = ordered[[0, 3, 2, 1]]
    return ordered


def _candidate_geometry(
    corners: np.ndarray,
    expected: np.ndarray,
    width: int,
    height: int,
) -> Optional[tuple[float, float, float, float]]:
    if corners.shape != (4, 2) or not np.isfinite(corners).all():
        return None
    if np.any(corners[:, 0] < 0) or np.any(corners[:, 0] > width - 1):
        return None
    if np.any(corners[:, 1] < 0) or np.any(corners[:, 1] > height - 1):
        return None
    contour = corners.astype(np.float32)
    if not cv2.isContourConvex(contour):
        return None
    area = abs(float(cv2.contourArea(contour)))
    if area <= 1.0:
        return None
    top = float(np.linalg.norm(corners[1] - corners[0]))
    bottom = float(np.linalg.norm(corners[2] - corners[3]))
    left = float(np.linalg.norm(corners[3] - corners[0]))
    right = float(np.linalg.norm(corners[2] - corners[1]))
    if min(top, bottom, left, right) <= 1.0:
        return None
    average_width = (top + bottom) / 2.0
    average_height = (left + right) / 2.0
    normalized = corners / np.asarray([width - 1, height - 1], dtype=np.float64)
    expected_normalized = expected / np.asarray([width - 1, height - 1], dtype=np.float64)
    corner_deviation = float(np.max(np.abs(normalized - expected_normalized)))
    opposite_ratio = max(top, bottom) / min(top, bottom)
    return area / (width * height), average_width / average_height, corner_deviation, opposite_ratio


def _cluster_positions(
    values: Sequence[float], maximum_gap: float
) -> tuple[float, ...]:
    clustered: list[float] = []
    for value in sorted(float(item) for item in values):
        if not clustered or value - clustered[-1] > maximum_gap:
            clustered.append(value)
        else:
            clustered[-1] = (clustered[-1] + value) / 2.0
    return tuple(clustered)


def _monotonic_assignment(
    required: Sequence[float], observed: Sequence[float]
) -> tuple[float, ...] | None:
    if len(observed) < len(required):
        return None

    expected_count = len(required)
    observed_count = len(observed)
    costs = np.full((expected_count + 1, observed_count + 1), np.inf, dtype=np.float64)
    previous = np.full((expected_count + 1, observed_count + 1), -1, dtype=np.int8)
    costs[0, :] = 0.0

    for expected_index in range(1, expected_count + 1):
        for observed_index in range(1, observed_count + 1):
            skip_cost = costs[expected_index, observed_index - 1]
            match_cost = costs[expected_index - 1, observed_index - 1] + abs(
                required[expected_index - 1] - observed[observed_index - 1]
            )
            if match_cost <= skip_cost:
                costs[expected_index, observed_index] = match_cost
                previous[expected_index, observed_index] = 1
            else:
                costs[expected_index, observed_index] = skip_cost
                previous[expected_index, observed_index] = 0

    assigned = [0.0] * expected_count
    expected_index, observed_index = expected_count, observed_count
    while expected_index > 0 and observed_index > 0:
        if previous[expected_index, observed_index] == 1:
            assigned[expected_index - 1] = observed[observed_index - 1]
            expected_index -= 1
            observed_index -= 1
        else:
            observed_index -= 1

    if expected_index != 0:
        return None
    return tuple(float(value) for value in assigned)


def _row_topology_evidence(
    positions: Sequence[float], config: PSAFormRegistrationConfig
) -> _RowTopologyEvidence:
    clustered = _cluster_positions(positions, config.line_cluster_distance)
    required = tuple(
        sorted({value for _, top, bottom in config.target_row_bands for value in (top, bottom)})
    )
    assigned = _monotonic_assignment(required, clustered)
    if assigned is None:
        return _RowTopologyEvidence(
            positions=clustered,
            assigned=(),
            residuals=(),
            score=0.0,
            covered=False,
            mean_residual=float("inf"),
            terminal_residual=float("inf"),
        )

    residuals = tuple(abs(actual - expected) for actual, expected in zip(assigned, required))
    mean_residual = float(np.mean(residuals))
    terminal_residual = float(np.mean(residuals[-2:]))
    topology_consistent = bool(
        assigned[0] >= -config.row_topology_tolerance
        and assigned[-1] <= 1.0 + config.row_topology_tolerance
        and all(second - first >= 0.02 for first, second in zip(assigned, assigned[1:]))
    )
    covered = bool(
        topology_consistent
        and all(value <= config.row_topology_tolerance for value in residuals)
    )
    score = max(0.0, 1.0 - mean_residual / config.row_topology_tolerance)
    return _RowTopologyEvidence(
        positions=clustered,
        assigned=assigned,
        residuals=residuals,
        score=score,
        covered=covered,
        mean_residual=mean_residual,
        terminal_residual=terminal_residual,
    )


def _candidate_horizontal_positions(
    corners: np.ndarray,
    horizontal_lines: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
    *,
    minimum: float = -0.05,
    maximum: float = 1.05,
) -> tuple[float, ...]:
    target = np.asarray([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    homography = cv2.getPerspectiveTransform(corners.astype(np.float32), target)
    source_x_min = float(corners[:, 0].min())
    source_x_max = float(corners[:, 0].max())
    observed: list[float] = []

    for line in horizontal_lines:
        a, b, c = line.coefficients
        if abs(b) < 1e-8:
            continue
        points = np.asarray(
            [
                [source_x_min, -(a * source_x_min + c) / b],
                [source_x_max, -(a * source_x_max + c) / b],
            ],
            dtype=np.float32,
        ).reshape(-1, 1, 2)
        transformed = cv2.perspectiveTransform(points, homography).reshape(-1, 2)
        value = float(np.mean(transformed[:, 1]))
        if minimum <= value <= maximum:
            observed.append(value)

    return _cluster_positions(observed, config.line_cluster_distance)


def _row_coverage_score(
    corners: np.ndarray,
    horizontal_lines: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
) -> tuple[float, bool]:
    positions = _candidate_horizontal_positions(
        corners, horizontal_lines, config, minimum=-0.05, maximum=1.05
    )
    evidence = _row_topology_evidence(positions, config)
    return evidence.score, evidence.covered


def _extend_candidate_bottom(
    candidate: _Candidate,
    normalized_bottom: float,
    expected: np.ndarray,
    width: int,
    height: int,
) -> _Candidate | None:
    unit = np.asarray([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    try:
        source_to_unit = cv2.getPerspectiveTransform(
            candidate.corners.astype(np.float32), unit
        )
        unit_to_source = np.linalg.inv(source_to_unit)
        lower = np.asarray(
            [[[1.0, normalized_bottom], [0.0, normalized_bottom]]],
            dtype=np.float32,
        )
        projected = cv2.perspectiveTransform(lower, unit_to_source).reshape(2, 2)
    except (cv2.error, np.linalg.LinAlgError):
        return None
    corners = np.asarray(
        [candidate.corners[0], candidate.corners[1], projected[0], projected[1]],
        dtype=np.float64,
    )
    geometry = _candidate_geometry(corners, expected, width, height)
    if geometry is None:
        return None
    area_ratio, aspect_ratio, deviation, opposite_ratio = geometry
    return replace(
        candidate,
        corners=corners,
        area_ratio=area_ratio,
        aspect_ratio=aspect_ratio,
        corner_deviation=deviation,
        opposite_edge_ratio=opposite_ratio,
        target_bottom_extended=True,
    )


def _repair_premature_bottom_boundary(
    candidate: _Candidate,
    horizontal_lines: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
    width: int,
    height: int,
) -> _Candidate:
    all_positions = _candidate_horizontal_positions(
        candidate.corners,
        horizontal_lines,
        config,
        minimum=-0.05,
        maximum=config.continuation_search_limit,
    )
    continuation = tuple(
        value
        for value in all_positions
        if value >= 1.0 + config.continuation_minimum_offset
    )
    candidate = replace(candidate, continuation_line_count=len(continuation))
    if len(continuation) < 2:
        return candidate

    base_positions = tuple(value for value in all_positions if value <= 1.05)
    base_evidence = _row_topology_evidence(base_positions, config)
    base_maximum_residual = (
        max(base_evidence.residuals) if base_evidence.residuals else float("inf")
    )
    expected = _expected_pixels(config, width, height)
    best: tuple[float, _Candidate, _RowTopologyEvidence] | None = None

    for normalized_bottom in continuation:
        extended = _extend_candidate_bottom(
            candidate, normalized_bottom, expected, width, height
        )
        if extended is None:
            continue
        if extended.corner_deviation > config.maximum_extended_corner_deviation:
            continue
        if extended.opposite_edge_ratio > config.review_opposite_edge_ratio:
            continue

        positions = _candidate_horizontal_positions(
            extended.corners, horizontal_lines, config, minimum=-0.05, maximum=1.05
        )
        evidence = _row_topology_evidence(positions, config)
        if not evidence.covered:
            continue

        maximum_residual = (
            max(evidence.residuals) if evidence.residuals else float("inf")
        )
        terminal_improvement = base_evidence.terminal_residual - evidence.terminal_residual
        mean_improvement = base_evidence.mean_residual - evidence.mean_residual
        maximum_residual_improvement = base_maximum_residual - maximum_residual

        terminal_supported = bool(
            terminal_improvement >= config.continuation_improvement_margin
            and mean_improvement > 0.0
        )
        aggregate_supported = bool(
            mean_improvement >= config.continuation_mean_improvement_margin
            and maximum_residual_improvement
            >= config.continuation_maximum_residual_improvement_margin
            and terminal_improvement
            >= -config.continuation_terminal_regression_tolerance
        )
        if not terminal_supported and not aggregate_supported:
            continue

        acceptance_mode = "terminal" if terminal_supported else "aggregate"
        extended = replace(
            extended,
            selected_bottom_continuation_position=normalized_bottom,
            bottom_continuation_acceptance_mode=acceptance_mode,
        )
        objective = (
            evidence.mean_residual
            + evidence.terminal_residual
            + 0.25 * maximum_residual
        )
        if best is None or objective < best[0]:
            best = (objective, extended, evidence)

    if best is None:
        return candidate

    _, extended, evidence = best
    score_bonus = min(
        0.05,
        max(0.0, evidence.score - base_evidence.score) * 0.25,
    )
    return replace(
        extended,
        score=min(1.0, candidate.score + score_bonus),
        continuation_line_count=len(continuation),
    )


def _candidate_vertical_positions(
    corners: np.ndarray,
    vertical_lines: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
    *,
    minimum: float = -0.05,
    maximum: float = 1.05,
) -> tuple[float, ...]:
    target = np.asarray([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    homography = cv2.getPerspectiveTransform(corners.astype(np.float32), target)
    source_y_min = float(corners[:, 1].min())
    source_y_max = float(corners[:, 1].max())
    observed: list[float] = []

    for line in vertical_lines:
        a, b, c = line.coefficients
        if abs(a) < 1e-8:
            continue
        points = np.asarray(
            [
                [-(b * source_y_min + c) / a, source_y_min],
                [-(b * source_y_max + c) / a, source_y_max],
            ],
            dtype=np.float32,
        ).reshape(-1, 1, 2)
        transformed = cv2.perspectiveTransform(points, homography).reshape(-1, 2)
        value = float(np.mean(transformed[:, 0]))
        if minimum <= value <= maximum:
            observed.append(value)

    return _cluster_positions(observed, config.line_cluster_distance)


def _right_coverage_evidence(
    divider_position: float, config: PSAFormRegistrationConfig
) -> _RightCoverageEvidence:
    residual = abs(divider_position - config.target_last_name_divider_position)
    score = max(
        0.0,
        1.0 - residual / config.target_last_name_divider_tolerance,
    )
    return _RightCoverageEvidence(
        divider_position=divider_position,
        residual=residual,
        score=score,
        covered=residual <= config.target_last_name_divider_tolerance,
    )


def _extend_candidate_right(
    candidate: _Candidate,
    normalized_right: float,
    expected: np.ndarray,
    width: int,
    height: int,
) -> _Candidate | None:
    unit = np.asarray([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    try:
        source_to_unit = cv2.getPerspectiveTransform(
            candidate.corners.astype(np.float32), unit
        )
        unit_to_source = np.linalg.inv(source_to_unit)
        extended_edge = np.asarray(
            [[[normalized_right, 0.0], [normalized_right, 1.0]]],
            dtype=np.float32,
        )
        projected = cv2.perspectiveTransform(
            extended_edge, unit_to_source
        ).reshape(2, 2)
    except (cv2.error, np.linalg.LinAlgError):
        return None

    corners = np.asarray(
        [candidate.corners[0], projected[0], projected[1], candidate.corners[3]],
        dtype=np.float64,
    )
    geometry = _candidate_geometry(corners, expected, width, height)
    if geometry is None:
        return None

    try:
        extended_to_unit = cv2.getPerspectiveTransform(
            corners.astype(np.float32), unit
        )
        original_right = np.asarray(
            [[candidate.corners[1], candidate.corners[2]]],
            dtype=np.float32,
        )
        relocated = cv2.perspectiveTransform(
            original_right, extended_to_unit
        ).reshape(2, 2)
        divider_position = float(np.mean(relocated[:, 0]))
    except cv2.error:
        return None

    area_ratio, aspect_ratio, deviation, opposite_ratio = geometry
    return replace(
        candidate,
        corners=corners,
        area_ratio=area_ratio,
        aspect_ratio=aspect_ratio,
        corner_deviation=deviation,
        opposite_edge_ratio=opposite_ratio,
        target_right_extended=True,
        target_last_name_divider_position=divider_position,
    )


def _repair_premature_right_boundary(
    candidate: _Candidate,
    vertical_lines: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
    width: int,
    height: int,
) -> _Candidate:
    all_positions = _candidate_vertical_positions(
        candidate.corners,
        vertical_lines,
        config,
        minimum=-0.05,
        maximum=config.right_continuation_search_limit,
    )
    continuation = tuple(
        value
        for value in all_positions
        if value >= 1.0 + config.right_continuation_minimum_offset
    )
    candidate = replace(
        candidate,
        right_continuation_line_count=len(continuation),
    )
    if len(continuation) < 2:
        return candidate

    base_evidence = _right_coverage_evidence(
        candidate.target_last_name_divider_position,
        config,
    )
    expected = _expected_pixels(config, width, height)
    best: tuple[float, _Candidate, _RightCoverageEvidence] | None = None

    for normalized_right in continuation:
        extended = _extend_candidate_right(
            candidate, normalized_right, expected, width, height
        )
        if extended is None:
            continue
        if extended.corner_deviation > config.maximum_extended_corner_deviation:
            continue
        if extended.opposite_edge_ratio > config.review_opposite_edge_ratio:
            continue

        remaining = tuple(
            value
            for value in continuation
            if value
            > normalized_right
            * (1.0 + config.right_continuation_clearance_ratio)
        )
        if remaining:
            continue

        evidence = _right_coverage_evidence(
            extended.target_last_name_divider_position,
            config,
        )
        broad_tolerance = max(
            0.070,
            config.target_last_name_divider_tolerance * 1.5,
        )
        if evidence.residual > broad_tolerance:
            continue

        improvement = base_evidence.residual - evidence.residual
        if improvement < config.right_continuation_improvement_margin:
            continue

        aspect_residual = abs(
            extended.aspect_ratio - config.expected_aspect_ratio
        )
        area_residual = abs(
            extended.area_ratio - config.expected_area_ratio
        )
        objective = (
            0.50 * aspect_residual
            + 0.25 * area_residual
            + 0.10 * evidence.residual
        )
        extended = replace(
            extended,
            selected_right_continuation_position=normalized_right,
            remaining_right_continuation_count=0,
        )
        if best is None or objective < best[0]:
            best = (objective, extended, evidence)

    if best is None:
        return candidate

    _, extended, evidence = best
    score_bonus = min(
        0.05,
        max(0.0, evidence.score - base_evidence.score) * 0.05,
    )
    return replace(
        extended,
        score=min(1.0, candidate.score + score_bonus),
        right_continuation_line_count=len(continuation),
    )


def _registered_horizontal_positions(
    registered: np.ndarray, config: PSAFormRegistrationConfig
) -> tuple[float, ...]:
    gray = (
        cv2.cvtColor(registered, cv2.COLOR_BGR2GRAY)
        if registered.ndim == 3
        else registered.copy()
    )
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        41,
        15,
    )
    height, width = gray.shape
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (max(80, width // 4), 1)
    )
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    central = horizontal[:, round(width * 0.08) : round(width * 0.96)]
    coverage = np.count_nonzero(central, axis=1) / float(max(1, central.shape[1]))
    rows = np.flatnonzero(coverage >= config.registered_line_minimum_coverage)
    return _cluster_positions(
        tuple(index / float(height - 1) for index in rows),
        config.line_cluster_distance,
    )


def _registered_row_topology(
    registered: np.ndarray, config: PSAFormRegistrationConfig
) -> _RowTopologyEvidence:
    return _row_topology_evidence(_registered_horizontal_positions(registered, config), config)


def _deduplicate_candidates(
    candidates: Sequence[_Candidate], config: PSAFormRegistrationConfig, width: int, height: int
) -> list[_Candidate]:
    unique: list[_Candidate] = []
    scale = np.asarray([width - 1, height - 1], dtype=np.float64)
    for candidate in sorted(candidates, key=lambda item: item.score, reverse=True):
        normalized = candidate.corners / scale
        duplicate = False
        for existing in unique:
            existing_normalized = existing.corners / scale
            corner_distance = float(np.mean(np.linalg.norm(normalized - existing_normalized, axis=1)))
            intersection_area, _ = cv2.intersectConvexConvex(
                candidate.corners.astype(np.float32), existing.corners.astype(np.float32)
            )
            union_area = (
                abs(float(cv2.contourArea(candidate.corners.astype(np.float32))))
                + abs(float(cv2.contourArea(existing.corners.astype(np.float32))))
                - float(intersection_area)
            )
            overlap = float(intersection_area) / union_area if union_area > 0.0 else 0.0
            if overlap >= 0.62 or corner_distance <= config.ambiguity_corner_distance:
                duplicate = True
                break
        if duplicate:
            continue
        unique.append(candidate)
    return unique


def _profile_peaks(
    profile: np.ndarray, minimum_distance: int, threshold: float
) -> tuple[int, ...]:
    if profile.ndim != 1 or profile.size == 0:
        return ()
    peaks: list[int] = []
    last = -minimum_distance
    for index in range(1, profile.size - 1):
        if profile[index] < threshold:
            continue
        if profile[index] < profile[index - 1] or profile[index] < profile[index + 1]:
            continue
        if peaks and index - last < minimum_distance:
            if profile[index] > profile[peaks[-1]]:
                peaks[-1] = index
                last = index
            continue
        peaks.append(index)
        last = index
    return tuple(peaks)


def _canonical_landmark_sequence_is_valid(
    vertical_landmarks: Sequence[float], horizontal_landmarks: Sequence[float]
) -> bool:
    return not (
        any(
            second <= first
            for first, second in zip(vertical_landmarks, vertical_landmarks[1:])
        )
        or any(
            second <= first
            for first, second in zip(horizontal_landmarks, horizontal_landmarks[1:])
        )
    )


def _canonical_edge_status(
    maximum_canonical_edge_deviation: float, config: PSAFormRegistrationConfig
) -> str:
    if maximum_canonical_edge_deviation <= config.success_canonical_edge_deviation:
        return "success"
    if maximum_canonical_edge_deviation <= config.review_canonical_edge_deviation:
        return "review_required"
    return "failed"


def _canonical_landmarks(
    registered: np.ndarray, config: PSAFormRegistrationConfig
) -> tuple[float, float, float, float, tuple[float, ...], tuple[float, ...], float] | None:
    if registered.ndim == 3:
        gray = cv2.cvtColor(registered, cv2.COLOR_BGR2GRAY)
    elif registered.ndim == 2:
        gray = registered
    else:
        return None
    if gray.size == 0 or not np.isfinite(gray).all():
        return None

    dark = 255.0 - gray.astype(np.float64)
    column_profile = dark.mean(axis=0)
    row_profile = dark.mean(axis=1)
    width = int(registered.shape[1])
    height = int(registered.shape[0])
    if width < 4 or height < 4:
        return None

    left_window = max(4, min(width // 6, int(width * 0.08)))
    right_window = left_window
    top_window = max(4, min(height // 6, int(height * 0.08)))
    bottom_window = top_window

    def edge_index(profile: np.ndarray, start: bool, window: int) -> int:
        band = profile[:window] if start else profile[-window:]
        if band.size == 0:
            return 0 if start else profile.size - 1
        baseline = float(np.median(band))
        spread = float(np.std(band))
        threshold = baseline + max(8.0, spread * 0.5)
        candidates = np.flatnonzero(band >= threshold)
        if candidates.size == 0:
            index = int(np.argmax(band))
        else:
            index = int(candidates[0] if start else candidates[-1])
        return index if start else profile.size - window + index

    left_index = edge_index(column_profile, True, left_window)
    right_index = edge_index(column_profile, False, right_window)
    top_index = edge_index(row_profile, True, top_window)
    bottom_index = edge_index(row_profile, False, bottom_window)

    vertical_threshold = float(np.percentile(column_profile, 80.0))
    horizontal_threshold = float(np.percentile(row_profile, 80.0))
    vertical_landmarks = _profile_peaks(
        column_profile, max(12, width // 80), vertical_threshold
    )
    horizontal_landmarks = _profile_peaks(
        row_profile, max(12, height // 80), horizontal_threshold
    )
    vertical_landmarks = tuple(
        index / float(width - 1)
        for index in vertical_landmarks
        if 0 < index < width - 1
    )
    horizontal_landmarks = tuple(
        index / float(height - 1)
        for index in horizontal_landmarks
        if 0 < index < height - 1
    )
    if len(vertical_landmarks) < config.minimum_canonical_vertical_landmarks:
        return None
    if len(horizontal_landmarks) < config.minimum_canonical_horizontal_landmarks:
        return None
    if not _canonical_landmark_sequence_is_valid(
        vertical_landmarks, horizontal_landmarks
    ):
        return None

    left_boundary = left_index / float(width - 1)
    right_boundary = right_index / float(width - 1)
    top_boundary = top_index / float(height - 1)
    bottom_boundary = bottom_index / float(height - 1)
    maximum_edge_deviation = max(
        abs(left_boundary - 0.0),
        abs(right_boundary - 1.0),
        abs(top_boundary - 0.0),
        abs(bottom_boundary - 1.0),
    )
    return (
        left_boundary,
        right_boundary,
        top_boundary,
        bottom_boundary,
        vertical_landmarks,
        horizontal_landmarks,
        maximum_edge_deviation,
    )


def _find_candidates(
    horizontal: Sequence[_DetectedLine],
    vertical: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
    width: int,
    height: int,
) -> tuple[list[_Candidate], int, int]:
    expected = _expected_pixels(config, width, height)
    diagonal = math.hypot(width, height)
    expected_lines = {
        "top": _expected_boundary(expected, 0, 1, width, height),
        "right": _expected_boundary(expected, 1, 2, width, height),
        "bottom": _expected_boundary(expected, 3, 2, width, height),
        "left": _expected_boundary(expected, 0, 3, width, height),
    }
    boundary_points = {
        "top": expected[[0, 1]],
        "right": expected[[1, 2]],
        "bottom": expected[[3, 2]],
        "left": expected[[0, 3]],
    }
    options = {
        "top": _boundary_options(horizontal, expected_lines["top"], expected[[0, 1]], diagonal, config),
        "right": _boundary_options(vertical, expected_lines["right"], expected[[1, 2]], diagonal, config),
        "bottom": _boundary_options(horizontal, expected_lines["bottom"], expected[[3, 2]], diagonal, config),
        "left": _boundary_options(vertical, expected_lines["left"], expected[[0, 3]], diagonal, config),
    }
    missing = [name for name, values in options.items() if not values]
    if len(missing) > 1:
        return [], len(missing), 0

    inference_trigger = min(0.065, config.review_corner_deviation)
    weak_boundaries = []
    for name, values in options.items():
        if not values:
            weak_boundaries.append(name)
            continue
        nearest_distance = min(
            max(_point_line_distance(point, line, diagonal) for point in boundary_points[name])
            for line in values
        )
        if nearest_distance > inference_trigger:
            weak_boundaries.append(name)
    inferred_name = weak_boundaries[0] if len(weak_boundaries) == 1 else None
    if missing and inferred_name is None:
        return [], len(missing), 0
    choices = {
        name: [(line, False) for line in values]
        + ([(expected_lines[name], True)] if name == inferred_name else [])
        for name, values in options.items()
    }

    candidates: list[_Candidate] = []
    intersection_count = 0
    for top, top_inferred in choices["top"]:
        for right, right_inferred in choices["right"]:
            for bottom, bottom_inferred in choices["bottom"]:
                for left, left_inferred in choices["left"]:
                    boundary_inferred = any(
                        (top_inferred, right_inferred, bottom_inferred, left_inferred)
                    )
                    points = (
                        _intersection(left, top),
                        _intersection(right, top),
                        _intersection(right, bottom),
                        _intersection(left, bottom),
                    )
                    if any(point is None for point in points):
                        continue
                    intersection_count += 4
                    corners = np.asarray(points, dtype=np.float64)
                    geometry = _candidate_geometry(corners, expected, width, height)
                    if geometry is None:
                        continue
                    area_ratio, aspect_ratio, deviation, opposite_ratio = geometry
                    row_score, _ = _row_coverage_score(corners, horizontal, config)
                    strength = sum(line.strength for line in (top, right, bottom, left)) / (4.0 * diagonal)
                    line_score = min(len(horizontal) / config.expected_horizontal_lines, 1.0) * 0.6 + min(
                        len(vertical) / config.expected_vertical_lines, 1.0
                    ) * 0.4
                    parallelism = 1.0 - min(
                        (_angle_difference(top.angle, bottom.angle) + _angle_difference(left.angle, right.angle))
                        / (2.0 * config.line_angle_tolerance_degrees),
                        1.0,
                    )
                    calibration = max(0.0, 1.0 - deviation / config.review_corner_deviation)
                    aspect = max(0.0, 1.0 - abs(aspect_ratio - config.expected_aspect_ratio) / 0.25)
                    area = max(0.0, 1.0 - abs(area_ratio - config.expected_area_ratio) / 0.05)
                    score = (
                        0.15 * min(strength, 1.0)
                        + 0.15 * line_score
                        + 0.10 * parallelism
                        + 0.15 * calibration
                        + 0.15 * aspect
                        + 0.10 * area
                        + 0.20 * row_score
                    )
                    if boundary_inferred:
                        score -= 0.08
                    candidates.append(
                        _Candidate(
                            corners=corners,
                            score=float(score),
                            area_ratio=area_ratio,
                            aspect_ratio=aspect_ratio,
                            corner_deviation=deviation,
                            opposite_edge_ratio=opposite_ratio,
                            boundary_inferred=boundary_inferred,
                        )
                    )
    unique = _deduplicate_candidates(candidates, config, width, height)
    repaired: list[_Candidate] = []
    for candidate in unique:
        bottom_repaired = _repair_premature_bottom_boundary(
            candidate, horizontal, config, width, height
        )
        repaired.append(
            _repair_premature_right_boundary(
                bottom_repaired, vertical, config, width, height
            )
        )
    repaired.sort(key=lambda item: item.score, reverse=True)
    return repaired, len(missing), intersection_count


def _orientation_deviation(
    corners: np.ndarray, config: PSAFormRegistrationConfig, width: int, height: int
) -> float:
    expected = _expected_pixels(config, width, height)

    def edge_angle(points: np.ndarray, first: int, second: int) -> float:
        vector = points[second] - points[first]
        return math.degrees(math.atan2(float(vector[1]), float(vector[0]))) % 180.0

    return max(
        _angle_difference(edge_angle(corners, 0, 1), edge_angle(expected, 0, 1)),
        _angle_difference(edge_angle(corners, 0, 3), edge_angle(expected, 0, 3)),
    )


def register_psa_birth_form(
    raw_image: Any,
    config: PSAFormRegistrationConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSAFormRegistrationOutput]:
    """Register the visible PSA birth-form grid to calibrated coordinates."""
    try:
        resolved = _build_config(config)
    except (KeyError, TypeError, ValueError):
        return _failure("INVALID_REGISTRATION_CONFIG")

    source = _prepare_source(raw_image)
    if source is None:
        return _failure("INVALID_SOURCE_IMAGE")
    height, width = source.shape[:2]
    if width < resolved.minimum_source_width or height < resolved.minimum_source_height:
        return _failure("SOURCE_IMAGE_TOO_SMALL", source_dimensions=(width, height))

    try:
        gray, _, _, edges, horizontal_mask, vertical_mask = _variants(source)
        horizontal, vertical = _detect_lines(
            edges,
            horizontal_mask,
            vertical_mask,
            width,
            height,
            resolved,
        )
    except cv2.error:
        return _failure("FORM_GRID_NOT_FOUND", source_dimensions=(width, height))

    horizontal_count = min(len(horizontal), resolved.expected_horizontal_lines)
    vertical_count = min(len(vertical), resolved.expected_vertical_lines)
    if horizontal_count < resolved.review_horizontal_lines or vertical_count < resolved.review_vertical_lines:
        return _failure(
            "FORM_GRID_NOT_FOUND",
            source_dimensions=(width, height),
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
        )

    candidates, missing_count, intersection_count = _find_candidates(
        horizontal, vertical, resolved, width, height
    )
    if not candidates:
        if missing_count > 1:
            code = "FORM_BOUNDARIES_INCOMPLETE"
        elif intersection_count == 0:
            code = "FORM_INTERSECTIONS_INVALID"
        else:
            code = "FORM_GEOMETRY_INVALID"
        return _failure(
            code,
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=0,
        )

    selected = candidates[0]
    if selected.opposite_edge_ratio > resolved.review_opposite_edge_ratio:
        return _failure("FORM_PERSPECTIVE_EXCESSIVE", candidate_count=len(candidates))
    allowed_corner_deviation = (
        resolved.maximum_extended_corner_deviation
        if selected.target_bottom_extended or selected.target_right_extended
        else resolved.review_corner_deviation
    )
    if selected.corner_deviation > allowed_corner_deviation:
        return _failure("FORM_POSITION_OUTSIDE_CALIBRATION", candidate_count=len(candidates))
    if (
        len(candidates) > 1
        and selected.score - candidates[1].score <= resolved.ambiguity_score_gap
    ):
        return _failure(
            "FORM_REGISTRATION_AMBIGUOUS",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
        )

    if selected.continuation_line_count >= 1 and not selected.target_bottom_extended:
        return _failure(
            "TARGET_ROWS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
            continuation_line_count=selected.continuation_line_count,
            target_bottom_extended=False,
        )
    if (
        selected.right_continuation_line_count >= 1
        and not selected.target_right_extended
    ):
        return _failure(
            "TARGET_COLUMNS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
            right_continuation_line_count=selected.right_continuation_line_count,
            target_right_extended=False,
        )

    prewarp_right_coverage = _right_coverage_evidence(
        selected.target_last_name_divider_position,
        resolved,
    )
    if (
        selected.target_right_extended
        and selected.remaining_right_continuation_count > 0
    ):
        return _failure(
            "TARGET_COLUMNS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
            target_right_extended=True,
            right_continuation_line_count=selected.right_continuation_line_count,
            selected_right_continuation_position=(
                selected.selected_right_continuation_position
            ),
            remaining_right_continuation_count=(
                selected.remaining_right_continuation_count
            ),
        )

    prewarp_topology = _row_topology_evidence(
        _candidate_horizontal_positions(
            selected.corners, horizontal, resolved, minimum=-0.05, maximum=1.05
        ),
        resolved,
    )
    _, rows_covered = _row_coverage_score(selected.corners, horizontal, resolved)
    if not rows_covered:
        return _failure(
            "TARGET_ROWS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
        )

    destination = np.asarray(
        [
            [0, 0],
            [resolved.output_width - 1, 0],
            [resolved.output_width - 1, resolved.output_height - 1],
            [0, resolved.output_height - 1],
        ],
        dtype=np.float32,
    )
    try:
        homography = cv2.getPerspectiveTransform(selected.corners.astype(np.float32), destination)
        if homography.shape != (3, 3) or not np.isfinite(homography).all():
            return _failure("PERSPECTIVE_TRANSFORM_FAILED")
        # ``homography`` is part of the artifact contract used to project the
        # registered cell polygons back onto the private original capture.  A
        # later canonical re-warp must therefore be composed into this matrix;
        # retaining only the first transform shifts the admin overlay away
        # from the cells that were actually uploaded.
        effective_homography = np.asarray(homography, dtype=np.float64)
        registered = cv2.warpPerspective(
            source,
            homography,
            (resolved.output_width, resolved.output_height),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
    except cv2.error:
        return _failure("PERSPECTIVE_TRANSFORM_FAILED")

    if registered is None or registered.shape[:2] != (resolved.output_height, resolved.output_width):
        return _failure("OUTPUT_DIMENSIONS_INVALID")
    if registered.dtype != source.dtype or not registered.flags.c_contiguous:
        registered = np.ascontiguousarray(registered, dtype=source.dtype)
    if registered.size == 0 or not np.isfinite(registered).all():
        return _failure("REGISTERED_IMAGE_INVALID")
    registered = registered.copy()

    postwarp_topology = _registered_row_topology(registered, resolved)
    postwarp_maximum_residual = (
        max(postwarp_topology.residuals) if postwarp_topology.residuals else None
    )
    postwarp_topology_elevated = not postwarp_topology.covered
    if postwarp_topology_elevated and (
        postwarp_maximum_residual is None
        or postwarp_maximum_residual > resolved.row_topology_tolerance * 2.5
    ):
        return _failure(
            "TARGET_ROWS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
            target_bottom_extended=selected.target_bottom_extended,
            continuation_line_count=selected.continuation_line_count,
            postwarp_target_topology_score=postwarp_topology.score,
            postwarp_target_maximum_residual=postwarp_maximum_residual,
        )

    postwarp_right_coverage = _right_coverage_evidence(
        selected.target_last_name_divider_position,
        resolved,
    )

    canonical = _canonical_landmarks(registered, resolved)
    if canonical is None:
        return _failure(
            "CANONICAL_GRID_LANDMARKS_INVALID",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
        )

    postcanonical_divider_position = selected.target_last_name_divider_position
    canonical_status = _canonical_edge_status(canonical[-1], resolved)
    if canonical_status == "failed":
        inferable_boundary = (
            horizontal_count < resolved.expected_horizontal_lines
            or vertical_count < resolved.expected_vertical_lines
        )
        near_canonical_grid = selected.corner_deviation <= resolved.review_corner_deviation
        if not inferable_boundary and not near_canonical_grid:
            return _failure(
                "CANONICAL_GRID_ALIGNMENT_FAILED",
                horizontal_line_count=horizontal_count,
                vertical_line_count=vertical_count,
                candidate_count=len(candidates),
                maximum_canonical_edge_deviation=canonical[-1],
            )
        canonical_status = "review_required"
    if canonical_status == "review_required":
        source_quad = np.asarray(
            [
                [canonical[0] * (resolved.output_width - 1), canonical[2] * (resolved.output_height - 1)],
                [canonical[1] * (resolved.output_width - 1), canonical[2] * (resolved.output_height - 1)],
                [canonical[1] * (resolved.output_width - 1), canonical[3] * (resolved.output_height - 1)],
                [canonical[0] * (resolved.output_width - 1), canonical[3] * (resolved.output_height - 1)],
            ],
            dtype=np.float32,
        )
        canonical_destination = np.asarray(
            [
                [0, 0],
                [resolved.output_width - 1, 0],
                [resolved.output_width - 1, resolved.output_height - 1],
                [0, resolved.output_height - 1],
            ],
            dtype=np.float32,
        )
        canonical_width = canonical[1] - canonical[0]
        if canonical_width <= 0.0:
            return _failure(
                "CANONICAL_GRID_ALIGNMENT_FAILED",
                horizontal_line_count=horizontal_count,
                vertical_line_count=vertical_count,
                candidate_count=len(candidates),
            )
        postcanonical_divider_position = (
            selected.target_last_name_divider_position - canonical[0]
        ) / canonical_width

        try:
            canonical_homography = cv2.getPerspectiveTransform(
                source_quad, canonical_destination
            )
            if canonical_homography.shape != (3, 3) or not np.isfinite(canonical_homography).all():
                return _failure(
                    "CANONICAL_GRID_ALIGNMENT_FAILED",
                    horizontal_line_count=horizontal_count,
                    vertical_line_count=vertical_count,
                    candidate_count=len(candidates),
                )
            registered = cv2.warpPerspective(
                registered,
                canonical_homography,
                (resolved.output_width, resolved.output_height),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
            effective_homography = (
                np.asarray(canonical_homography, dtype=np.float64)
                @ effective_homography
            )
        except cv2.error:
            return _failure(
                "CANONICAL_GRID_ALIGNMENT_FAILED",
                horizontal_line_count=horizontal_count,
                vertical_line_count=vertical_count,
                candidate_count=len(candidates),
            )

        canonical = _canonical_landmarks(registered, resolved)
        if canonical is None:
            return _failure(
                "CANONICAL_GRID_LANDMARKS_INVALID",
                horizontal_line_count=horizontal_count,
                vertical_line_count=vertical_count,
                candidate_count=len(candidates),
            )

    final_topology = _registered_row_topology(registered, resolved)
    final_maximum_residual = (
        max(final_topology.residuals) if final_topology.residuals else None
    )
    final_topology_elevated = not final_topology.covered
    if final_topology_elevated and (
        final_maximum_residual is None
        or final_maximum_residual > resolved.row_topology_tolerance * 2.5
    ):
        return _failure(
            "TARGET_ROWS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
            target_bottom_extended=selected.target_bottom_extended,
            continuation_line_count=selected.continuation_line_count,
            postcanonical_target_topology_score=final_topology.score,
            postcanonical_target_maximum_residual=final_maximum_residual,
        )

    final_right_coverage = _right_coverage_evidence(
        postcanonical_divider_position,
        resolved,
    )
    if (
        selected.target_right_extended
        and selected.remaining_right_continuation_count > 0
    ):
        return _failure(
            "TARGET_COLUMNS_OUTSIDE_FRAME",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
            target_right_extended=True,
            right_continuation_line_count=selected.right_continuation_line_count,
            selected_right_continuation_position=(
                selected.selected_right_continuation_position
            ),
            remaining_right_continuation_count=(
                selected.remaining_right_continuation_count
            ),
        )

    (
        canonical_left_boundary,
        canonical_right_boundary,
        canonical_top_boundary,
        canonical_bottom_boundary,
        canonical_vertical_landmarks,
        canonical_horizontal_landmarks,
        maximum_canonical_edge_deviation,
    ) = canonical
    canonical_status = _canonical_edge_status(maximum_canonical_edge_deviation, resolved)
    if canonical_status == "failed":
        inferable_boundary = (
            horizontal_count < resolved.expected_horizontal_lines
            or vertical_count < resolved.expected_vertical_lines
        )
        near_canonical_grid = selected.corner_deviation <= resolved.review_corner_deviation
        if not inferable_boundary and not near_canonical_grid:
            return _failure(
                "CANONICAL_GRID_ALIGNMENT_FAILED",
                horizontal_line_count=horizontal_count,
                vertical_line_count=vertical_count,
                candidate_count=len(candidates),
                maximum_canonical_edge_deviation=maximum_canonical_edge_deviation,
            )
        canonical_status = "review_required"

    orientation_deviation = _orientation_deviation(selected.corners, resolved, width, height)
    canonical_boundary_inferred = (
        canonical_status == "review_required"
        and (
            horizontal_count < resolved.expected_horizontal_lines
            or vertical_count < resolved.expected_vertical_lines
        )
    )
    issues: list[dict[str, str]] = []
    if horizontal_count < resolved.success_horizontal_lines or vertical_count < resolved.success_vertical_lines:
        issues.append(_issue("FORM_LINE_EVIDENCE_WEAK"))
    if selected.boundary_inferred:
        issues.append(_issue("FORM_BOUNDARY_INFERRED"))
    if selected.target_bottom_extended:
        issues.append(_issue("FORM_TARGET_BOTTOM_EXTENDED"))
    if selected.target_right_extended:
        issues.append(_issue("FORM_TARGET_RIGHT_EXTENDED"))
    if postwarp_topology_elevated or final_topology_elevated:
        issues.append(_issue("FORM_TARGET_TOPOLOGY_ELEVATED"))
    if selected.corner_deviation > resolved.success_corner_deviation or orientation_deviation > 2.0:
        issues.append(_issue("FORM_POSITION_DEVIATION_ELEVATED"))
    if selected.opposite_edge_ratio > resolved.success_opposite_edge_ratio:
        issues.append(_issue("FORM_PERSPECTIVE_ELEVATED"))
    if canonical_status == "review_required":
        issues.append(_issue("CANONICAL_GRID_ALIGNMENT_ELEVATED"))
    if selected.boundary_inferred or canonical_boundary_inferred:
        issues.append(_issue("CANONICAL_GRID_BOUNDARY_INFERRED"))
    if (
        float(np.std(gray)) < resolved.minimum_contrast_standard_deviation
        or float(cv2.Laplacian(gray, cv2.CV_64F).var()) < resolved.minimum_laplacian_variance
    ):
        issues.append(_issue("FORM_IMAGE_QUALITY_DEGRADED"))

    normalized = selected.corners / np.asarray([width - 1, height - 1], dtype=np.float64)
    normalized_corners = tuple(NormalizedPoint(float(point[0]), float(point[1])) for point in normalized)
    metadata = PSAFormTransformationMetadata(
        source_dimensions=(width, height),
        output_dimensions=(resolved.output_width, resolved.output_height),
        normalized_registration_corners=normalized_corners,
        homography=tuple(
            float(value) for value in effective_homography.reshape(-1)
        ),
        horizontal_line_count=horizontal_count,
        vertical_line_count=vertical_count,
        intersection_count=4,
        candidate_count=len(candidates),
        candidate_score=selected.score,
        registration_area_ratio=selected.area_ratio,
        aspect_ratio=selected.aspect_ratio,
        maximum_corner_deviation=selected.corner_deviation,
        opposite_edge_ratio=selected.opposite_edge_ratio,
        maximum_canonical_edge_deviation=maximum_canonical_edge_deviation,
        canonical_left_boundary=canonical_left_boundary,
        canonical_right_boundary=canonical_right_boundary,
        canonical_top_boundary=canonical_top_boundary,
        canonical_bottom_boundary=canonical_bottom_boundary,
        canonical_vertical_landmarks=canonical_vertical_landmarks,
        canonical_horizontal_landmarks=canonical_horizontal_landmarks,
        perspective_applied=not np.allclose(homography, np.eye(3), atol=1e-6),
        boundary_inferred=selected.boundary_inferred or canonical_boundary_inferred,
    )
    output = PSAFormRegistrationOutput(registered_image=registered, transformation_metadata=metadata)
    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required" if issues else "success",
        data=output,
        issues=issues,
        metrics={
            "horizontal_line_count": horizontal_count,
            "vertical_line_count": vertical_count,
            "candidate_count": len(candidates),
            "candidate_score": selected.score,
            "registration_area_ratio": selected.area_ratio,
            "aspect_ratio": selected.aspect_ratio,
            "maximum_corner_deviation": selected.corner_deviation,
            "opposite_edge_ratio": selected.opposite_edge_ratio,
            "maximum_canonical_edge_deviation": maximum_canonical_edge_deviation,
            "orientation_deviation_degrees": orientation_deviation,
            "target_bottom_extended": selected.target_bottom_extended,
            "continuation_line_count": selected.continuation_line_count,
            "selected_bottom_continuation_position": (
                selected.selected_bottom_continuation_position
            ),
            "bottom_continuation_acceptance_mode": (
                selected.bottom_continuation_acceptance_mode
            ),
            "target_right_extended": selected.target_right_extended,
            "right_continuation_line_count": (
                selected.right_continuation_line_count
            ),
            "selected_right_continuation_position": (
                selected.selected_right_continuation_position
            ),
            "remaining_right_continuation_count": (
                selected.remaining_right_continuation_count
            ),
            "prewarp_right_coverage": prewarp_right_coverage.score,
            "postwarp_right_coverage": postwarp_right_coverage.score,
            "postcanonical_right_coverage": final_right_coverage.score,
            "target_last_name_divider_position": (
                final_right_coverage.divider_position
            ),
            "prewarp_target_topology_score": prewarp_topology.score,
            "postwarp_target_topology_score": postwarp_topology.score,
            "postcanonical_target_topology_score": final_topology.score,
            "postcanonical_target_maximum_residual": final_maximum_residual,
        },
    )


def register_psa_birth_form_grid_envelope(
    raw_image: Any,
    config: PSAFormRegistrationConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSAFormRegistrationOutput]:
    """Recover a displaced PSA grid, then enforce canonical topology.

    This is intentionally separate from the normal station calibration. It
    does not authorize coordinate extraction merely because a rectangle was
    found: the warped candidate must contain all calibrated PSA row bands,
    enough vertical/horizontal landmarks, and registered outer edges.
    """
    try:
        resolved = _build_config(config)
    except (KeyError, TypeError, ValueError):
        return _failure("INVALID_REGISTRATION_CONFIG")

    source = _prepare_source(raw_image)
    if source is None:
        return _failure("INVALID_SOURCE_IMAGE")
    height, width = source.shape[:2]
    if width < resolved.minimum_source_width or height < resolved.minimum_source_height:
        return _failure("SOURCE_IMAGE_TOO_SMALL", source_dimensions=(width, height))

    try:
        _, _, _, _, horizontal_mask, vertical_mask = _variants(source)
        grid_mask = cv2.bitwise_or(horizontal_mask, vertical_mask)
        grid_mask = cv2.dilate(
            grid_mask,
            cv2.getStructuringElement(
                cv2.MORPH_RECT,
                (
                    max(5, int(round(width * 0.0035))),
                    max(5, int(round(height * 0.0045))),
                ),
            ),
            iterations=2,
        )
        contours = cv2.findContours(
            grid_mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )[0]
    except cv2.error:
        return _failure("FORM_GRID_ENVELOPE_NOT_FOUND")

    destination = np.asarray(
        [
            [0, 0],
            [resolved.output_width - 1, 0],
            [resolved.output_width - 1, resolved.output_height - 1],
            [0, resolved.output_height - 1],
        ],
        dtype=np.float32,
    )
    candidates: list[tuple[float, np.ndarray, np.ndarray, np.ndarray, Any, Any]] = []
    minimum_area = resolved.expected_area_ratio * 0.35
    maximum_area = min(0.55, resolved.expected_area_ratio * 3.0)

    for contour in contours:
        hull = cv2.convexHull(contour)
        perimeter = cv2.arcLength(hull, True)
        if perimeter <= 0:
            continue
        approximation = None
        for epsilon in (0.005, 0.01, 0.02, 0.03):
            proposed = cv2.approxPolyDP(
                hull,
                epsilon * perimeter,
                True,
            ).reshape(-1, 2)
            if len(proposed) == 4:
                approximation = proposed
                break
        if approximation is None:
            continue
        try:
            corners = _order_corners(approximation)
        except ValueError:
            continue
        expected = _expected_pixels(resolved, width, height)
        geometry = _candidate_geometry(corners, expected, width, height)
        if geometry is None:
            continue
        area_ratio, aspect_ratio, _corner_deviation, opposite_ratio = geometry
        if not minimum_area <= area_ratio <= maximum_area:
            continue
        if not 0.72 <= aspect_ratio <= 1.38:
            continue
        if opposite_ratio > resolved.review_opposite_edge_ratio:
            continue

        try:
            homography = cv2.getPerspectiveTransform(
                corners.astype(np.float32),
                destination,
            )
            registered = cv2.warpPerspective(
                source,
                homography,
                (resolved.output_width, resolved.output_height),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
        except cv2.error:
            continue
        if registered is None or registered.shape[:2] != (
            resolved.output_height,
            resolved.output_width,
        ):
            continue
        registered = np.ascontiguousarray(registered, dtype=source.dtype)
        row_topology = _registered_row_topology(registered, resolved)
        canonical = _canonical_landmarks(registered, resolved)
        if not row_topology.covered or canonical is None:
            continue
        if canonical[6] > resolved.review_canonical_edge_deviation:
            continue

        area_score = max(
            0.0,
            1.0 - abs(area_ratio - resolved.expected_area_ratio) / resolved.expected_area_ratio,
        )
        aspect_score = max(
            0.0,
            1.0 - abs(aspect_ratio - resolved.expected_aspect_ratio) / 0.35,
        )
        score = 0.65 * row_topology.score + 0.20 * aspect_score + 0.15 * area_score
        candidates.append(
            (score, corners, homography, registered, row_topology, canonical)
        )

    if not candidates:
        return _failure(
            "FORM_GRID_ENVELOPE_TOPOLOGY_INVALID",
            source_dimensions=(width, height),
            envelope_candidate_count=0,
        )

    candidates.sort(key=lambda item: item[0], reverse=True)
    score, corners, homography, registered, row_topology, canonical = candidates[0]
    normalized = corners / np.asarray([width - 1, height - 1], dtype=np.float64)
    top = float(np.linalg.norm(corners[1] - corners[0]))
    bottom = float(np.linalg.norm(corners[2] - corners[3]))
    left = float(np.linalg.norm(corners[3] - corners[0]))
    right = float(np.linalg.norm(corners[2] - corners[1]))
    area_ratio = abs(float(cv2.contourArea(corners.astype(np.float32)))) / float(width * height)
    aspect_ratio = ((top + bottom) / 2.0) / ((left + right) / 2.0)
    metadata = PSAFormTransformationMetadata(
        source_dimensions=(width, height),
        output_dimensions=(resolved.output_width, resolved.output_height),
        normalized_registration_corners=tuple(
            NormalizedPoint(float(point[0]), float(point[1]))
            for point in normalized
        ),
        homography=tuple(float(value) for value in homography.reshape(-1)),
        horizontal_line_count=len(row_topology.positions),
        vertical_line_count=len(canonical[4]),
        intersection_count=(
            len(row_topology.positions) * len(canonical[4])
        ),
        candidate_count=len(candidates),
        candidate_score=float(score),
        registration_area_ratio=area_ratio,
        aspect_ratio=aspect_ratio,
        maximum_corner_deviation=float(
            np.max(np.abs(normalized - np.asarray([
                [point.x, point.y] for point in resolved.expected_corners
            ], dtype=np.float64)))
        ),
        opposite_edge_ratio=max(top, bottom) / min(top, bottom),
        maximum_canonical_edge_deviation=float(canonical[6]),
        canonical_left_boundary=float(canonical[0]),
        canonical_right_boundary=float(canonical[1]),
        canonical_top_boundary=float(canonical[2]),
        canonical_bottom_boundary=float(canonical[3]),
        canonical_vertical_landmarks=tuple(canonical[4]),
        canonical_horizontal_landmarks=tuple(canonical[5]),
        perspective_applied=True,
        boundary_inferred=False,
    )
    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required",
        data=PSAFormRegistrationOutput(
            registered_image=registered.copy(),
            transformation_metadata=metadata,
        ),
        issues=[_issue("REGISTRATION_GRID_ENVELOPE_RECOVERY")],
        metrics={
            "registration_mode": "validated_grid_envelope",
            "candidate_count": len(candidates),
            "candidate_score": round(float(score), 6),
            "postwarp_target_topology_score": row_topology.score,
            "postwarp_target_maximum_residual": max(row_topology.residuals),
            "maximum_canonical_edge_deviation": canonical[6],
        },
    )


CALIBRATION_DEFAULTS: Mapping[str, Any] = MappingProxyType(
    {
        "corners": _default_corners(),
        "area_ratio": 0.139107,
        "aspect_ratio": 1.018127,
        "horizontal_lines": 14,
        "vertical_lines": 5,
        "target_row_bands": _default_row_bands(),
    }
)
