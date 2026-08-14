from __future__ import annotations

import math
from dataclasses import dataclass, field
from numbers import Real
from types import MappingProxyType
from typing import Any, Mapping

import cv2
import numpy as np

from .geometry import NormalizedBounds
from .models import RegionResult
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_cropper"
REGISTERED_WIDTH = 1400
REGISTERED_HEIGHT = 1375
GEOMETRY_ARTIFACT_VERSION = 3
GEOMETRY_MODE = "validated_per_row_topology"
PREPROCESSING_VARIANT = "registered_fixed_per_row_name_cell"
FIELD_NAMES = ("child_name", "mother_maiden_name", "father_name")
COMPONENT_NAMES = ("first_name", "middle_name", "last_name")
DEFAULT_PERSISTENT_HORIZONTAL_GRID_COVERAGE = 0.72
DEFAULT_PERSISTENT_VERTICAL_GRID_COVERAGE = 0.78
DEFAULT_MINIMUM_PERSISTENT_GRID_THICKNESS_PIXELS = 2


def _default_row_geometries() -> tuple[
    tuple[str, int, int, int, int, int, int], ...
]:
    """Return the accepted geometry-only calibration for the canonical form."""

    return (
        ("child_name", 358, 652, 963, 1248, 50, 104),
        ("mother_maiden_name", 321, 587, 923, 1211, 685, 732),
        ("father_name", 278, 580, 921, 1268, 1238, 1290),
    )


@dataclass(frozen=True)
class PSABirthRowCropperConfig:
    registered_width: int = REGISTERED_WIDTH
    registered_height: int = REGISTERED_HEIGHT
    row_geometries: tuple[
        tuple[str, int, int, int, int, int, int], ...
    ] = field(default_factory=_default_row_geometries)
    internal_padding_pixels: int = 4
    vertical_inset_pixels: int = 1
    minimum_cell_width_pixels: int = 100
    minimum_cell_height_pixels: int = 26
    persistent_horizontal_grid_coverage: float = (
        DEFAULT_PERSISTENT_HORIZONTAL_GRID_COVERAGE
    )
    persistent_vertical_grid_coverage: float = (
        DEFAULT_PERSISTENT_VERTICAL_GRID_COVERAGE
    )
    minimum_persistent_grid_thickness_pixels: int = (
        DEFAULT_MINIMUM_PERSISTENT_GRID_THICKNESS_PIXELS
    )
    review_on_registration_issue: bool = True
    topology_horizontal_search_pixels: int = 28
    topology_vertical_search_pixels: int = 36
    topology_minimum_line_coverage: float = 0.42
    topology_intersection_radius_pixels: int = 5
    allow_calibrated_topology_fallback: bool = True

    def __post_init__(self) -> None:
        if (self.registered_width, self.registered_height) != (
            REGISTERED_WIDTH,
            REGISTERED_HEIGHT,
        ):
            raise ValueError(
                "registered dimensions must remain at 1400 by 1375"
            )

        rows = tuple(tuple(row) for row in self.row_geometries)
        if len(rows) != 3 or tuple(row[0] for row in rows) != FIELD_NAMES:
            raise ValueError(
                "row_geometries must contain the three approved birth fields"
            )

        for row in rows:
            if len(row) != 7:
                raise ValueError(
                    "each per-row geometry must contain seven values"
                )
            (
                _field_name,
                label_right,
                first_right,
                middle_right,
                last_right,
                value_top,
                value_bottom,
            ) = row
            values = (
                label_right,
                first_right,
                middle_right,
                last_right,
                value_top,
                value_bottom,
            )
            if not all(
                isinstance(value, int) and not isinstance(value, bool)
                for value in values
            ):
                raise ValueError(
                    "per-row geometry coordinates must be integers"
                )
            if not (
                0
                < label_right
                < first_right
                < middle_right
                < last_right
                <= REGISTERED_WIDTH
            ):
                raise ValueError(
                    "per-row column boundaries must be ordered and in range"
                )
            if not (
                0 <= value_top < value_bottom <= REGISTERED_HEIGHT
            ):
                raise ValueError(
                    "per-row value band must be ordered and in range"
                )

        for field_name in (
            "internal_padding_pixels",
            "vertical_inset_pixels",
            "minimum_cell_width_pixels",
            "minimum_cell_height_pixels",
            "topology_horizontal_search_pixels",
            "topology_vertical_search_pixels",
            "topology_intersection_radius_pixels",
        ):
            value = getattr(self, field_name)
            if (
                isinstance(value, bool)
                or not isinstance(value, int)
                or value < 0
            ):
                raise ValueError(
                    f"{field_name} must be a non-negative integer"
                )

        if not 0.0 < self.topology_minimum_line_coverage <= 1.0:
            raise ValueError(
                "topology_minimum_line_coverage must be in the interval (0, 1]"
            )

        thickness = self.minimum_persistent_grid_thickness_pixels
        if (
            isinstance(thickness, bool)
            or not isinstance(thickness, int)
            or thickness <= 0
        ):
            raise ValueError(
                "minimum persistent grid thickness must be positive"
            )

        for field_name in (
            "persistent_horizontal_grid_coverage",
            "persistent_vertical_grid_coverage",
        ):
            value = getattr(self, field_name)
            if (
                isinstance(value, bool)
                or not isinstance(value, Real)
                or not math.isfinite(value)
                or not 0.0 < float(value) <= 1.0
            ):
                raise ValueError(
                    f"{field_name} must be in the interval (0, 1]"
                )

        object.__setattr__(self, "row_geometries", rows)


@dataclass(frozen=True)
class PSABirthRowCropperOutput:
    regions: tuple[RegionResult, ...]
    crops: Mapping[str, np.ndarray]
    registered_width: int
    registered_height: int
    row_crops: Mapping[str, np.ndarray] = field(default_factory=dict)
    topology: Mapping[str, "ValidatedNameRowTopology"] = field(default_factory=dict)


@dataclass(frozen=True)
class ValidatedNameRowTopology:
    field_name: str
    top: int
    bottom: int
    component_boundaries: tuple[int, int, int, int]
    horizontal_coverage: tuple[float, float]
    vertical_coverage: tuple[float, float, float, float]
    maximum_residual_pixels: int
    intersection_count: int
    evidence_status: str = "matched"
    evidence_issue_codes: tuple[str, ...] = ()

    @property
    def relative_component_boundaries(self) -> tuple[float, float, float, float]:
        left, first, middle, right = self.component_boundaries
        span = float(max(1, right - left))
        return (
            0.0,
            (first - left) / span,
            (middle - left) / span,
            1.0,
        )


@dataclass(frozen=True)
class PSABirthRowCropperMetadata:
    status: str
    issues: tuple[Mapping[str, str], ...]
    transformation_metadata: Any = None


@dataclass(frozen=True)
class FixedNameRowGeometry:
    field_name: str
    label_right: int
    first_right: int
    middle_right: int
    last_right: int
    value_top: int
    value_bottom: int

    @property
    def component_boundaries(
        self,
    ) -> tuple[tuple[str, int, int], ...]:
        return (
            ("first_name", self.label_right, self.first_right),
            ("middle_name", self.first_right, self.middle_right),
            ("last_name", self.middle_right, self.last_right),
        )

    @property
    def columns(self) -> tuple[int, int, int, int]:
        return (
            self.label_right,
            self.first_right,
            self.middle_right,
            self.last_right,
        )


@dataclass(frozen=True)
class _GridLineEvidence:
    horizontal_coverage: float
    vertical_coverage: float
    maximum_horizontal_thickness: int
    maximum_vertical_thickness: int


@dataclass(frozen=True)
class CellGridMetrics:
    field_name: str
    component_name: str
    width: int
    height: int
    horizontal_coverage_before: float
    horizontal_coverage_after: float
    vertical_coverage_before: float
    vertical_coverage_after: float
    maximum_horizontal_thickness_before: int
    maximum_horizontal_thickness_after: int
    maximum_vertical_thickness_before: int
    maximum_vertical_thickness_after: int
    contaminated: bool

    def as_metrics(self) -> dict[str, Any]:
        return {
            "field_name": self.field_name,
            "component_name": self.component_name,
            "width": self.width,
            "height": self.height,
            "horizontal_coverage_before": (
                self.horizontal_coverage_before
            ),
            "horizontal_coverage_after": (
                self.horizontal_coverage_after
            ),
            "vertical_coverage_before": self.vertical_coverage_before,
            "vertical_coverage_after": self.vertical_coverage_after,
            "maximum_horizontal_thickness_before": (
                self.maximum_horizontal_thickness_before
            ),
            "maximum_horizontal_thickness_after": (
                self.maximum_horizontal_thickness_after
            ),
            "maximum_vertical_thickness_before": (
                self.maximum_vertical_thickness_before
            ),
            "maximum_vertical_thickness_after": (
                self.maximum_vertical_thickness_after
            ),
            "contaminated": self.contaminated,
        }


def _issue(
    code: str,
    field_name: str = "",
    component_name: str = "",
) -> dict[str, str]:
    issue = {
        "code": code,
        "stage": STAGE_NAME,
        "field": field_name,
    }
    if component_name:
        issue["component"] = component_name
    return issue


def _failure(
    code: str,
    field_name: str = "",
    component_name: str = "",
    **metrics: Any,
) -> StageResult[PSABirthRowCropperOutput]:
    return StageResult(
        stage=STAGE_NAME,
        success=False,
        status="failed",
        data=None,
        issues=[_issue(code, field_name, component_name)],
        metrics=dict(metrics),
    )


def _resolve_registration_metadata(
    registration_metadata: Any,
) -> PSABirthRowCropperMetadata | None:
    if registration_metadata is None:
        return None
    if isinstance(registration_metadata, Mapping):
        return PSABirthRowCropperMetadata(
            status=str(registration_metadata.get("status", "")),
            issues=tuple(
                dict(issue)
                for issue in registration_metadata.get("issues", ())
                if isinstance(issue, Mapping)
            ),
            transformation_metadata=registration_metadata.get(
                "transformation_metadata"
            ),
        )
    if hasattr(registration_metadata, "status") and hasattr(
        registration_metadata,
        "issues",
    ):
        data = getattr(registration_metadata, "data", None)
        transformation = getattr(
            registration_metadata,
            "transformation_metadata",
            getattr(data, "transformation_metadata", data),
        )
        return PSABirthRowCropperMetadata(
            status=str(getattr(registration_metadata, "status", "")),
            issues=tuple(
                dict(issue)
                for issue in getattr(registration_metadata, "issues", ())
                if isinstance(issue, Mapping)
            ),
            transformation_metadata=transformation,
        )
    return None


def _prepare_image(value: Any) -> np.ndarray | None:
    if not isinstance(value, np.ndarray) or value.dtype != np.uint8:
        return None
    if value.ndim == 2:
        return value
    if value.ndim == 3 and value.shape[2] in (3, 4):
        return value
    return None


def _resolve_config(
    config: PSABirthRowCropperConfig | Mapping[str, Any] | None,
) -> PSABirthRowCropperConfig:
    if config is None:
        return PSABirthRowCropperConfig()
    if isinstance(config, PSABirthRowCropperConfig):
        return PSABirthRowCropperConfig(**vars(config))
    if not isinstance(config, Mapping):
        raise ValueError("config must be a cropper config or mapping")
    allowed = set(PSABirthRowCropperConfig.__dataclass_fields__)
    unknown = set(config) - allowed
    if unknown:
        raise ValueError(
            f"unsupported configuration keys: {sorted(unknown)}"
        )
    values = dict(config)
    if "row_geometries" in values:
        values["row_geometries"] = tuple(
            tuple(row) for row in values["row_geometries"]
        )
    return PSABirthRowCropperConfig(**values)


def _fixed_rows(
    config: PSABirthRowCropperConfig,
) -> tuple[FixedNameRowGeometry, ...]:
    return tuple(
        FixedNameRowGeometry(*row)
        for row in config.row_geometries
    )


def _gray(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image.copy()
    conversion = (
        cv2.COLOR_BGRA2GRAY
        if image.shape[2] == 4
        else cv2.COLOR_BGR2GRAY
    )
    return cv2.cvtColor(image, conversion)


def _runs(indices: np.ndarray) -> list[tuple[int, int]]:
    if indices.size == 0:
        return []
    runs: list[tuple[int, int]] = []
    start = previous = int(indices[0])
    for value in indices[1:]:
        current = int(value)
        if current != previous + 1:
            runs.append((start, previous))
            start = current
        previous = current
    runs.append((start, previous))
    return runs


def _normalized_bounds(
    left: int,
    top: int,
    right: int,
    bottom: int,
) -> NormalizedBounds | None:
    if not 0 <= left < right <= REGISTERED_WIDTH:
        return None
    if not 0 <= top < bottom <= REGISTERED_HEIGHT:
        return None
    return NormalizedBounds(
        x=left / REGISTERED_WIDTH,
        y=top / REGISTERED_HEIGHT,
        width=(right - left) / REGISTERED_WIDTH,
        height=(bottom - top) / REGISTERED_HEIGHT,
    )


def _crop_name_cell(
    image: np.ndarray,
    *,
    left: int,
    right: int,
    top: int,
    bottom: int,
    horizontal_inset: int,
    vertical_inset: int,
    minimum_width: int,
    minimum_height: int,
) -> tuple[np.ndarray, tuple[int, int, int, int]] | None:
    x1 = left + horizontal_inset
    x2 = right - horizontal_inset
    y1 = top + vertical_inset
    y2 = bottom - vertical_inset
    if x2 - x1 < minimum_width or y2 - y1 < minimum_height:
        return None
    if not 0 <= x1 < x2 <= image.shape[1]:
        return None
    if not 0 <= y1 < y2 <= image.shape[0]:
        return None
    return (
        np.array(image[y1:y2, x1:x2], copy=True),
        (x1, y1, x2, y2),
    )


def _grid_line_masks(
    cell: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    gray = _gray(cell)
    inverse = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
    )[1]
    height, width = gray.shape
    horizontal_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (max(30, width // 3), 1),
    )
    vertical_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (1, max(15, round(height * 0.8))),
    )
    horizontal = cv2.morphologyEx(
        inverse,
        cv2.MORPH_OPEN,
        horizontal_kernel,
    )
    vertical = cv2.morphologyEx(
        inverse,
        cv2.MORPH_OPEN,
        vertical_kernel,
    )
    return horizontal, vertical


def _maximum_projection_run(
    projection: np.ndarray,
    *,
    denominator: int,
    minimum_coverage: float,
) -> int:
    if denominator <= 0 or projection.size == 0:
        return 0
    qualifying = np.flatnonzero(
        projection.astype(np.float64) / float(denominator)
        >= minimum_coverage
    )
    return max(
        (
            stop - start + 1
            for start, stop in _runs(qualifying)
        ),
        default=0,
    )


def _grid_line_evidence(
    cell: np.ndarray,
    *,
    horizontal_threshold: float,
    vertical_threshold: float,
) -> _GridLineEvidence:
    gray = _gray(cell)
    horizontal, vertical = _grid_line_masks(gray)
    height, width = gray.shape
    horizontal_projection = np.count_nonzero(
        horizontal,
        axis=1,
    )
    vertical_projection = np.count_nonzero(
        vertical,
        axis=0,
    )
    horizontal_coverage = (
        float(np.max(horizontal_projection)) / float(width)
        if horizontal_projection.size and width
        else 0.0
    )
    vertical_coverage = (
        float(np.max(vertical_projection)) / float(height)
        if vertical_projection.size and height
        else 0.0
    )
    return _GridLineEvidence(
        horizontal_coverage=horizontal_coverage,
        vertical_coverage=vertical_coverage,
        maximum_horizontal_thickness=_maximum_projection_run(
            horizontal_projection,
            denominator=width,
            minimum_coverage=horizontal_threshold,
        ),
        maximum_vertical_thickness=_maximum_projection_run(
            vertical_projection,
            denominator=height,
            minimum_coverage=vertical_threshold,
        ),
    )


def _remove_grid_lines(cell: np.ndarray) -> np.ndarray:
    gray = _gray(cell)
    horizontal, vertical = _grid_line_masks(gray)
    if not np.any(horizontal) and not np.any(vertical):
        return gray
    horizontal_cleanup_mask = cv2.dilate(
        horizontal,
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (1, 3),
        ),
        iterations=1,
    )
    vertical_cleanup_mask = cv2.dilate(
        vertical,
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (3, 1),
        ),
        iterations=1,
    )
    line_mask = cv2.bitwise_or(
        horizontal_cleanup_mask,
        vertical_cleanup_mask,
    )
    return cv2.inpaint(
        gray,
        line_mask,
        2,
        cv2.INPAINT_TELEA,
    )


def _measure_cell_grid_metrics(
    raw_cell: np.ndarray,
    cleaned_cell: np.ndarray,
    *,
    field_name: str,
    component_name: str,
    horizontal_threshold: float,
    vertical_threshold: float,
    minimum_thickness: int,
) -> CellGridMetrics:
    before = _grid_line_evidence(
        raw_cell,
        horizontal_threshold=horizontal_threshold,
        vertical_threshold=vertical_threshold,
    )
    after = _grid_line_evidence(
        cleaned_cell,
        horizontal_threshold=horizontal_threshold,
        vertical_threshold=vertical_threshold,
    )
    persistent_horizontal_grid = (
        after.horizontal_coverage >= horizontal_threshold
        and after.maximum_horizontal_thickness >= minimum_thickness
    )
    persistent_vertical_grid = (
        after.vertical_coverage >= vertical_threshold
        and after.maximum_vertical_thickness >= minimum_thickness
    )
    height, width = _gray(cleaned_cell).shape
    return CellGridMetrics(
        field_name=field_name,
        component_name=component_name,
        width=width,
        height=height,
        horizontal_coverage_before=before.horizontal_coverage,
        horizontal_coverage_after=after.horizontal_coverage,
        vertical_coverage_before=before.vertical_coverage,
        vertical_coverage_after=after.vertical_coverage,
        maximum_horizontal_thickness_before=(
            before.maximum_horizontal_thickness
        ),
        maximum_horizontal_thickness_after=(
            after.maximum_horizontal_thickness
        ),
        maximum_vertical_thickness_before=(
            before.maximum_vertical_thickness
        ),
        maximum_vertical_thickness_after=(
            after.maximum_vertical_thickness
        ),
        contaminated=bool(
            persistent_horizontal_grid
            or persistent_vertical_grid
        ),
    )


def _validate_cell_geometry(
    cell: np.ndarray,
    *,
    metrics: CellGridMetrics | None = None,
) -> bool:
    if metrics is not None:
        return not metrics.contaminated
    fallback_metrics = _measure_cell_grid_metrics(
        cell,
        cell,
        field_name="",
        component_name="",
        horizontal_threshold=(
            DEFAULT_PERSISTENT_HORIZONTAL_GRID_COVERAGE
        ),
        vertical_threshold=(
            DEFAULT_PERSISTENT_VERTICAL_GRID_COVERAGE
        ),
        minimum_thickness=(
            DEFAULT_MINIMUM_PERSISTENT_GRID_THICKNESS_PIXELS
        ),
    )
    return not fallback_metrics.contaminated


def _registration_requires_review(
    metadata: PSABirthRowCropperMetadata | None,
) -> bool:
    if metadata is None:
        return False
    if metadata.status == "review_required":
        return True
    return bool(metadata.issues)


def _strongest_projection_position(
    projection: np.ndarray,
    *,
    expected: int,
    radius: int,
    denominator: int,
    minimum_coverage: float,
) -> tuple[int, float] | None:
    if projection.ndim != 1 or projection.size == 0 or denominator <= 0:
        return None
    start = max(0, expected - radius)
    stop = min(projection.size, expected + radius + 1)
    if start >= stop:
        return None
    window = projection[start:stop].astype(np.float64) / float(denominator)
    if window.size == 0:
        return None
    qualifying = np.flatnonzero(window >= minimum_coverage)
    if qualifying.size == 0:
        return None
    clusters = _runs(qualifying)
    cluster_start, cluster_stop = min(
        clusters,
        key=lambda run: (
            abs((start + ((run[0] + run[1]) // 2)) - expected),
            -float(np.max(window[run[0] : run[1] + 1])),
        ),
    )
    best_offset = int(round((cluster_start + cluster_stop) / 2.0))
    coverage = float(np.max(window[cluster_start : cluster_stop + 1]))
    return start + best_offset, coverage


def _validate_name_row_topology(
    image: np.ndarray,
    row: FixedNameRowGeometry,
    config: PSABirthRowCropperConfig,
) -> ValidatedNameRowTopology | None:
    gray = _gray(image)
    inverse = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
    )[1]
    expected_boundaries = row.columns
    expected_top = max(0, row.value_top - config.vertical_inset_pixels - 2)
    expected_bottom = min(
        image.shape[0] - 1,
        row.value_bottom + config.vertical_inset_pixels + 2,
    )
    left = max(0, expected_boundaries[0] - config.topology_vertical_search_pixels)
    right = min(
        image.shape[1],
        expected_boundaries[-1] + config.topology_vertical_search_pixels + 1,
    )
    horizontal_projection = np.count_nonzero(inverse[:, left:right], axis=1)
    detected_top = _strongest_projection_position(
        horizontal_projection,
        expected=expected_top,
        radius=config.topology_horizontal_search_pixels,
        denominator=max(1, right - left),
        minimum_coverage=config.topology_minimum_line_coverage,
    )
    detected_bottom = _strongest_projection_position(
        horizontal_projection,
        expected=expected_bottom,
        radius=config.topology_horizontal_search_pixels,
        denominator=max(1, right - left),
        minimum_coverage=config.topology_minimum_line_coverage,
    )
    if detected_top is None or detected_bottom is None:
        return None
    top, top_coverage = detected_top
    bottom, bottom_coverage = detected_bottom
    if bottom - top < config.minimum_cell_height_pixels:
        return None

    vertical_projection = np.count_nonzero(
        inverse[top : bottom + 1, :],
        axis=0,
    )
    detected_boundaries: list[int] = []
    vertical_coverages: list[float] = []
    for expected in expected_boundaries:
        detected = _strongest_projection_position(
            vertical_projection,
            expected=expected,
            radius=config.topology_vertical_search_pixels,
            denominator=max(1, bottom - top + 1),
            minimum_coverage=config.topology_minimum_line_coverage,
        )
        if detected is None:
            return None
        position, coverage = detected
        detected_boundaries.append(position)
        vertical_coverages.append(coverage)
    if any(
        second - first < config.minimum_cell_width_pixels
        for first, second in zip(detected_boundaries, detected_boundaries[1:])
    ):
        return None

    intersection_count = 0
    radius = config.topology_intersection_radius_pixels
    for y in (top, bottom):
        for x in detected_boundaries:
            patch = inverse[
                max(0, y - radius) : min(image.shape[0], y + radius + 1),
                max(0, x - radius) : min(image.shape[1], x + radius + 1),
            ]
            if patch.size and np.count_nonzero(patch):
                intersection_count += 1
    if intersection_count != 8:
        return None

    residuals = (
        abs(top - expected_top),
        abs(bottom - expected_bottom),
        *(abs(value - expected) for value, expected in zip(
            detected_boundaries,
            expected_boundaries,
        )),
    )
    return ValidatedNameRowTopology(
        field_name=row.field_name,
        top=int(top),
        bottom=int(bottom),
        component_boundaries=tuple(int(value) for value in detected_boundaries),
        horizontal_coverage=(float(top_coverage), float(bottom_coverage)),
        vertical_coverage=tuple(float(value) for value in vertical_coverages),
        maximum_residual_pixels=max(residuals),
        intersection_count=intersection_count,
    )


def validate_psa_birth_name_topology(
    registered_image: Any,
    config: PSABirthRowCropperConfig | Mapping[str, Any] | None = None,
) -> StageResult[Mapping[str, ValidatedNameRowTopology]]:
    try:
        resolved = _resolve_config(config)
    except (TypeError, ValueError):
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=None,
            issues=[_issue("BIRTH_NAME_TOPOLOGY_CONFIG_INVALID")],
            metrics={},
        )
    image = _prepare_image(registered_image)
    if image is None or image.shape[:2] != (REGISTERED_HEIGHT, REGISTERED_WIDTH):
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=None,
            issues=[_issue("BIRTH_NAME_TOPOLOGY_IMAGE_INVALID")],
            metrics={},
        )
    topology: dict[str, ValidatedNameRowTopology] = {}
    issues: list[dict[str, str]] = []
    fallback_rows: list[str] = []
    for row in _fixed_rows(resolved):
        detected = _validate_name_row_topology(image, row, resolved)
        if detected is None:
            if not resolved.allow_calibrated_topology_fallback:
                return StageResult(
                    stage=STAGE_NAME,
                    success=False,
                    status="failed",
                    data=None,
                    issues=[_issue("BIRTH_NAME_ROW_TOPOLOGY_INVALID", row.field_name)],
                    metrics={
                        "topology_status": "mismatch",
                        "validated_row_count": len(topology),
                    },
                )
            expected_top = max(
                0,
                row.value_top - resolved.vertical_inset_pixels - 2,
            )
            expected_bottom = min(
                image.shape[0] - 1,
                row.value_bottom + resolved.vertical_inset_pixels + 2,
            )
            detected = ValidatedNameRowTopology(
                field_name=row.field_name,
                top=expected_top,
                bottom=expected_bottom,
                component_boundaries=tuple(int(value) for value in row.columns),
                horizontal_coverage=(0.0, 0.0),
                vertical_coverage=(0.0, 0.0, 0.0, 0.0),
                maximum_residual_pixels=0,
                intersection_count=0,
                evidence_status="calibrated_fallback",
                evidence_issue_codes=("BIRTH_NAME_ROW_TOPOLOGY_WEAK",),
            )
            fallback_rows.append(row.field_name)
            issues.append(
                _issue("BIRTH_NAME_ROW_TOPOLOGY_WEAK", row.field_name)
            )
        topology[row.field_name] = detected
    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required" if issues else "success",
        data=MappingProxyType(dict(topology)),
        issues=issues,
        metrics={
            "topology_status": "calibrated_fallback" if fallback_rows else "matched",
            "validated_row_count": len(topology) - len(fallback_rows),
            "calibrated_fallback_row_count": len(fallback_rows),
            "calibrated_fallback_rows": fallback_rows,
            "validated_intersection_count": sum(
                item.intersection_count for item in topology.values()
            ),
            "maximum_residual_pixels": max(
                item.maximum_residual_pixels for item in topology.values()
            ),
        },
    )


def crop_psa_birth_name_rows(
    registered_image: Any,
    registration_metadata: Any = None,
    config: PSABirthRowCropperConfig | Mapping[str, Any] | None = None,
    topology: Mapping[str, ValidatedNameRowTopology] | None = None,
) -> StageResult[PSABirthRowCropperOutput]:
    try:
        resolved = _resolve_config(config)
    except (TypeError, ValueError):
        return _failure("TARGET_NAME_CELL_CROP_INVALID")

    image = _prepare_image(registered_image)
    if image is None:
        return _failure("REGISTERED_IMAGE_INVALID")

    height, width = image.shape[:2]
    if (width, height) != (REGISTERED_WIDTH, REGISTERED_HEIGHT):
        return _failure(
            "REGISTERED_DIMENSIONS_MISMATCH",
            registered_width=width,
            registered_height=height,
        )

    metadata = _resolve_registration_metadata(registration_metadata)
    if registration_metadata is not None and metadata is None:
        return _failure("REGISTRATION_METADATA_INVALID")

    if topology is None:
        topology_result = validate_psa_birth_name_topology(image, resolved)
        if not topology_result.success or topology_result.data is None:
            return _failure(
                "BIRTH_NAME_TOPOLOGY_REQUIRED",
                topology_status="mismatch",
                topology_issue_codes=tuple(
                    str(issue.get("code") or "")
                    for issue in topology_result.issues
                ),
            )
        resolved_topology = dict(topology_result.data)
    else:
        resolved_topology = dict(topology)
    if set(resolved_topology) != set(FIELD_NAMES) or not all(
        isinstance(resolved_topology.get(name), ValidatedNameRowTopology)
        for name in FIELD_NAMES
    ):
        return _failure("BIRTH_NAME_TOPOLOGY_REQUIRED")
    fallback_rows = [
        name
        for name, item in resolved_topology.items()
        if item.evidence_status != "matched"
    ]
    if fallback_rows and not resolved.allow_calibrated_topology_fallback:
        return _failure(
            "BIRTH_NAME_TOPOLOGY_REQUIRED",
            topology_status="mismatch",
            fallback_rows=tuple(fallback_rows),
        )

    regions: list[RegionResult] = []
    crops: dict[str, np.ndarray] = {}
    row_crops: dict[str, np.ndarray] = {}
    issues: list[dict[str, str]] = []
    cell_grid_metrics: dict[str, dict[str, Any]] = {}
    row_metrics: dict[str, Any] = {}

    fixed_rows = _fixed_rows(resolved)

    for row in fixed_rows:
        detected_topology = resolved_topology[row.field_name]
        detected_left, detected_first, detected_middle, detected_right = (
            detected_topology.component_boundaries
        )
        expected_border_top = max(
            0,
            row.value_top - resolved.vertical_inset_pixels - 2,
        )
        expected_border_bottom = min(
            image.shape[0] - 1,
            row.value_bottom + resolved.vertical_inset_pixels + 2,
        )
        crop_top = detected_topology.top + (row.value_top - expected_border_top)
        crop_bottom = detected_topology.bottom - (
            expected_border_bottom - row.value_bottom
        )
        if crop_bottom - crop_top < resolved.minimum_cell_height_pixels:
            return _failure("BIRTH_NAME_TOPOLOGY_REQUIRED", row.field_name)
        row_metrics[f"{row.field_name}_geometry_source"] = (
            "validated_per_row_topology"
        )
        row_metrics[f"{row.field_name}_value_top"] = crop_top
        row_metrics[f"{row.field_name}_value_bottom"] = crop_bottom
        row_metrics[f"{row.field_name}_column_boundaries"] = (
            detected_topology.component_boundaries
        )

        row_crop = _crop_name_cell(
            image,
            left=detected_left,
            right=detected_right,
            top=crop_top,
            bottom=crop_bottom,
            horizontal_inset=resolved.internal_padding_pixels,
            vertical_inset=0,
            minimum_width=resolved.minimum_cell_width_pixels * 3,
            minimum_height=resolved.minimum_cell_height_pixels,
        )
        if row_crop is None:
            return _failure("BIRTH_NAME_TOPOLOGY_REQUIRED", row.field_name)
        raw_row_crop, _ = row_crop
        row_crops[row.field_name] = _remove_grid_lines(raw_row_crop)

        for component_name, raw_left, raw_right in (
            (
                ("first_name", detected_left, detected_first),
                ("middle_name", detected_first, detected_middle),
                ("last_name", detected_middle, detected_right),
            )
        ):
            crop_result = _crop_name_cell(
                image,
                left=raw_left,
                right=raw_right,
                top=crop_top,
                bottom=crop_bottom,
                horizontal_inset=resolved.internal_padding_pixels,
                vertical_inset=resolved.vertical_inset_pixels,
                minimum_width=resolved.minimum_cell_width_pixels,
                minimum_height=resolved.minimum_cell_height_pixels,
            )
            if crop_result is None:
                item_number = {
                    "child_name": "1",
                    "mother_maiden_name": "6",
                    "father_name": "13",
                }[row.field_name]
                return _failure(
                    f"birth_item_{item_number}_value_band_invalid",
                    row.field_name,
                    component_name,
                    **row_metrics,
                )

            raw_crop, (left, top, right, bottom) = crop_result
            cleaned_crop = _remove_grid_lines(raw_crop)
            grid_metrics = _measure_cell_grid_metrics(
                raw_crop,
                cleaned_crop,
                field_name=row.field_name,
                component_name=component_name,
                horizontal_threshold=(
                    resolved.persistent_horizontal_grid_coverage
                ),
                vertical_threshold=(
                    resolved.persistent_vertical_grid_coverage
                ),
                minimum_thickness=(
                    resolved.minimum_persistent_grid_thickness_pixels
                ),
            )
            key = f"{row.field_name}.{component_name}"
            cell_grid_metrics[key] = grid_metrics.as_metrics()

            if not _validate_cell_geometry(
                cleaned_crop,
                metrics=grid_metrics,
            ):
                return _failure(
                    "birth_name_cell_grid_contaminated",
                    row.field_name,
                    component_name,
                    failed_cell_grid_metrics=(
                        grid_metrics.as_metrics()
                    ),
                    cell_grid_metrics=dict(cell_grid_metrics),
                    per_row_column_boundaries={
                        item.field_name: item.columns
                        for item in fixed_rows
                    },
                    **row_metrics,
                )

            bounds = _normalized_bounds(
                left,
                top,
                right,
                bottom,
            )
            if bounds is None:
                return _failure(
                    "TARGET_NAME_CELL_CROP_INVALID",
                    row.field_name,
                    component_name,
                    **row_metrics,
                )

            crops[key] = np.array(cleaned_crop, copy=True)
            regions.append(
                RegionResult(
                    name=key,
                    bounds=bounds,
                    success=True,
                    confidence=1.0,
                    ocr_attempts=0,
                    preprocessing_variant=PREPROCESSING_VARIANT,
                )
            )

    if len(regions) != 9 or len(crops) != 9:
        return _failure("TARGET_NAME_CELL_CROP_INVALID")

    registration_review = bool(
        resolved.review_on_registration_issue
        and _registration_requires_review(metadata)
    )
    if registration_review:
        issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))

    output = PSABirthRowCropperOutput(
        regions=tuple(regions),
        crops=MappingProxyType(
            {
                name: np.array(crop, copy=True)
                for name, crop in crops.items()
            }
        ),
        registered_width=width,
        registered_height=height,
        row_crops=MappingProxyType(
            {
                name: np.array(crop, copy=True)
                for name, crop in row_crops.items()
            }
        ),
        topology=MappingProxyType(dict(resolved_topology)),
    )

    metrics = {
        "registered_width": width,
        "registered_height": height,
        "geometry_artifact_version": GEOMETRY_ARTIFACT_VERSION,
        "geometry_mode": GEOMETRY_MODE,
        "geometry_source": "validated_private_visual_calibration",
        "region_count": len(regions),
        "cell_crop_count": len(crops),
        "per_row_column_boundaries": {
            name: item.component_boundaries
            for name, item in resolved_topology.items()
        },
        "per_row_value_bands": {
            row.field_name: (
                row_metrics[f"{row.field_name}_value_top"],
                row_metrics[f"{row.field_name}_value_bottom"],
            )
            for row in fixed_rows
        },
        "horizontal_inset_pixels": resolved.internal_padding_pixels,
        "vertical_inset_pixels": resolved.vertical_inset_pixels,
        "registration_review_propagated": registration_review,
        "full_row_crop_used": True,
        "dynamic_geometry_repositioning_used": True,
        "topology_status": (
            "calibrated_fallback" if fallback_rows else "matched"
        ),
        "validated_row_count": len(resolved_topology) - len(fallback_rows),
        "calibrated_fallback_row_count": len(fallback_rows),
        "calibrated_fallback_rows": tuple(fallback_rows),
        "validated_intersection_count": sum(
            item.intersection_count for item in resolved_topology.values()
        ),
        "cell_grid_metrics": dict(cell_grid_metrics),
        **row_metrics,
    }

    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required" if issues else "success",
        data=output,
        issues=issues,
        metrics=metrics,
    )
