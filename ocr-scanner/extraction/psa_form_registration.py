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
    for segment in segments[:, 0]:
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


def _row_coverage_score(
    corners: np.ndarray,
    horizontal_lines: Sequence[_DetectedLine],
    config: PSAFormRegistrationConfig,
) -> tuple[float, bool]:
    target = np.asarray([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    homography = cv2.getPerspectiveTransform(corners.astype(np.float32), target)
    observed: list[float] = []
    for line in horizontal_lines:
        a, b, c = line.coefficients
        if abs(b) < 1e-8:
            continue
        points = np.asarray(
            [[0.0, -c / b], [float(corners[:, 0].max()), -(a * corners[:, 0].max() + c) / b]],
            dtype=np.float32,
        ).reshape(-1, 1, 2)
        transformed = cv2.perspectiveTransform(points, homography).reshape(-1, 2)
        y = float(np.mean(transformed[:, 1]))
        if -0.05 <= y <= 1.05:
            observed.append(y)

    observed.sort()
    clustered: list[float] = []
    for value in observed:
        if not clustered or value - clustered[-1] > config.line_cluster_distance:
            clustered.append(value)
        else:
            clustered[-1] = (clustered[-1] + value) / 2.0

    required = sorted({value for _, top, bottom in config.target_row_bands for value in (top, bottom)})
    if len(clustered) < len(required):
        return 0.0, False

    expected_count = len(required)
    observed_count = len(clustered)
    costs = np.full((expected_count + 1, observed_count + 1), np.inf, dtype=np.float64)
    previous = np.full((expected_count + 1, observed_count + 1), -1, dtype=np.int8)
    costs[0, :] = 0.0
    for expected_index in range(1, expected_count + 1):
        for observed_index in range(1, observed_count + 1):
            skip_cost = costs[expected_index, observed_index - 1]
            match_cost = costs[expected_index - 1, observed_index - 1] + abs(
                required[expected_index - 1] - clustered[observed_index - 1]
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
            assigned[expected_index - 1] = clustered[observed_index - 1]
            expected_index -= 1
            observed_index -= 1
        else:
            observed_index -= 1
    if expected_index != 0:
        return 0.0, False

    residuals = np.abs(np.asarray(assigned) - np.asarray(required))
    target_covered = bool(np.all(residuals <= config.row_topology_tolerance))
    topology_consistent = bool(
        assigned[0] >= -config.row_topology_tolerance
        and assigned[-1] <= 1.0 + config.row_topology_tolerance
        and all(second - first >= 0.02 for first, second in zip(assigned, assigned[1:]))
    )
    score = max(0.0, 1.0 - float(residuals.mean()) / config.row_topology_tolerance)
    return score, target_covered and topology_consistent


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
    return _deduplicate_candidates(candidates, config, width, height), len(missing), intersection_count


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
    if selected.corner_deviation > resolved.review_corner_deviation:
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

    canonical = _canonical_landmarks(registered, resolved)
    if canonical is None:
        return _failure(
            "CANONICAL_GRID_LANDMARKS_INVALID",
            horizontal_line_count=horizontal_count,
            vertical_line_count=vertical_count,
            candidate_count=len(candidates),
        )

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
        homography=tuple(float(value) for value in homography.reshape(-1)),
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
