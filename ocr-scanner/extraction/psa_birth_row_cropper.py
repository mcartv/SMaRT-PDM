from __future__ import annotations

import math
from dataclasses import dataclass, field
from numbers import Real
from types import MappingProxyType
from typing import Any, Mapping

import numpy as np

from .geometry import NormalizedBounds
from .models import RegionResult
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_cropper"
REGISTERED_WIDTH = 1400
REGISTERED_HEIGHT = 1375
PREPROCESSING_VARIANT = "registered_name_cell"


def _default_name_regions() -> tuple[tuple[str, float, float, float, float], ...]:
    """Return calibrated value-cell bounds in the registered PSA grid.

    These rectangles are calibrated from the registered 1400x1375 PSA grid.
    They exclude the printed item number, NAME/MAIDEN NAME label, the
    (First)/(Middle)/(Last) headings, row borders, and neighboring rows. Each
    rectangle contains only the value band spanning all three name columns.
    """

    return (
        # Item 1: value band below the printed (First)/(Middle)/(Last) labels.
        ("child_name", 0.200, 0.030, 0.790, 0.036),
        # Item 6: maiden-name value band only.
        ("mother_maiden_name", 0.200, 0.447, 0.790, 0.042),
        # Item 13: father-name value band only.
        ("father_name", 0.200, 0.827, 0.790, 0.034),
    )


@dataclass(frozen=True)
class PSABirthRowCropperConfig:
    registered_width: int = REGISTERED_WIDTH
    registered_height: int = REGISTERED_HEIGHT
    name_regions: tuple[tuple[str, float, float, float, float], ...] = field(
        default_factory=_default_name_regions
    )
    row_bands: tuple[tuple[str, float, float], ...] | None = None
    review_on_registration_issue: bool = True

    def __post_init__(self) -> None:
        if (
            self.registered_width != REGISTERED_WIDTH
            or self.registered_height != REGISTERED_HEIGHT
        ):
            raise ValueError("registered dimensions must remain at 1400 by 1375")
        if any(
            isinstance(value, bool)
            or not isinstance(value, int)
            or value <= 0
            for value in (self.registered_width, self.registered_height)
        ):
            raise ValueError("registered dimensions must be positive integers")

        copied_regions = tuple(tuple(item) for item in self.name_regions)
        copied_row_bands = None
        if self.row_bands is not None:
            copied_row_bands = tuple(tuple(item) for item in self.row_bands)
            if len(copied_row_bands) != 3:
                raise ValueError("row_bands must contain exactly three entries")
            converted_regions = []
            for item in copied_row_bands:
                if len(item) != 3:
                    raise ValueError(
                        "each row band must contain name, top, and bottom"
                    )
                name, top, bottom = item
                if (
                    not isinstance(name, str)
                    or not name
                    or isinstance(top, bool)
                    or isinstance(bottom, bool)
                    or not isinstance(top, Real)
                    or not isinstance(bottom, Real)
                    or not math.isfinite(top)
                    or not math.isfinite(bottom)
                    or not 0.0 <= top < bottom <= 1.0
                ):
                    raise ValueError("row band bounds are invalid")
                converted_regions.append((name, 0.0, top, 1.0, bottom - top))
            copied_regions = tuple(converted_regions)

        if len(copied_regions) != 3:
            raise ValueError("name_regions must contain exactly three entries")

        names: set[str] = set()
        for item in copied_regions:
            if len(item) != 5:
                raise ValueError(
                    "each name region must contain name, x, y, width, and height"
                )
            name, x, y, width, height = item
            if not isinstance(name, str) or not name or name in names:
                raise ValueError("name region names must be unique non-empty strings")
            names.add(name)

            for value in (x, y, width, height):
                if (
                    isinstance(value, bool)
                    or not isinstance(value, Real)
                    or not math.isfinite(value)
                ):
                    raise ValueError("name region bounds must be finite numbers")

            if x < 0.0 or y < 0.0 or width <= 0.0 or height <= 0.0:
                raise ValueError("name region bounds must be positive and in range")
            if x + width > 1.0 or y + height > 1.0:
                raise ValueError("name region bounds must remain inside the page")

        required_names = {"child_name", "mother_maiden_name", "father_name"}
        if names != required_names:
            raise ValueError("name_regions must contain the approved birth fields")

        object.__setattr__(self, "name_regions", copied_regions)
        object.__setattr__(self, "row_bands", copied_row_bands)


@dataclass(frozen=True)
class PSABirthRowCropperOutput:
    regions: tuple[RegionResult, ...]
    crops: Mapping[str, np.ndarray]
    registered_width: int
    registered_height: int


@dataclass(frozen=True)
class PSABirthRowCropperMetadata:
    status: str
    issues: tuple[Mapping[str, str], ...]
    transformation_metadata: Any = None


def _issue(code: str) -> dict[str, str]:
    return {"code": code, "stage": STAGE_NAME, "field": ""}


def _failure(code: str, **metrics: Any) -> StageResult[PSABirthRowCropperOutput]:
    return StageResult(
        stage=STAGE_NAME,
        success=False,
        status="failed",
        data=None,
        issues=[_issue(code)],
        metrics=dict(metrics),
    )


def _resolve_registration_metadata(
    registration_metadata: Any,
) -> PSABirthRowCropperMetadata | None:
    if registration_metadata is None:
        return None
    if hasattr(registration_metadata, "transformation_metadata"):
        return PSABirthRowCropperMetadata(
            status=str(getattr(registration_metadata, "status", "")),
            issues=tuple(
                dict(issue) for issue in getattr(registration_metadata, "issues", [])
            ),
            transformation_metadata=getattr(
                registration_metadata,
                "transformation_metadata",
                None,
            ),
        )
    if hasattr(registration_metadata, "status") and hasattr(
        registration_metadata,
        "issues",
    ):
        return PSABirthRowCropperMetadata(
            status=str(getattr(registration_metadata, "status", "")),
            issues=tuple(
                dict(issue) for issue in getattr(registration_metadata, "issues", [])
            ),
            transformation_metadata=registration_metadata,
        )
    if isinstance(registration_metadata, Mapping):
        return PSABirthRowCropperMetadata(
            status=str(registration_metadata.get("status", "")),
            issues=tuple(
                dict(issue)
                for issue in registration_metadata.get("issues", [])
            ),
            transformation_metadata=registration_metadata.get(
                "transformation_metadata"
            ),
        )
    return None


def _is_review_level_registration(
    metadata: PSABirthRowCropperMetadata | None,
) -> bool:
    if metadata is None:
        return False
    if metadata.status == "review_required":
        return True
    issues = {issue.get("code") for issue in metadata.issues}
    return bool(
        {"REGISTRATION_REVIEW_PROPAGATED", "REGISTRATION_BOUNDARY_INFERRED"}
        & issues
    )


def _registration_boundary_inferred(
    metadata: PSABirthRowCropperMetadata | None,
) -> bool:
    if metadata is None:
        return False
    if metadata.status == "review_required":
        return True
    issues = {issue.get("code") for issue in metadata.issues}
    return "REGISTRATION_BOUNDARY_INFERRED" in issues


def _prepare_image(registered_image: Any) -> np.ndarray | None:
    if (
        not isinstance(registered_image, np.ndarray)
        or registered_image.dtype != np.uint8
    ):
        return None
    if registered_image.ndim == 2:
        return registered_image
    if registered_image.ndim == 3 and registered_image.shape[2] in (3, 4):
        return registered_image
    return None


def _validate_config(
    config: PSABirthRowCropperConfig | Mapping[str, Any] | None,
) -> PSABirthRowCropperConfig:
    if config is None:
        return PSABirthRowCropperConfig()
    if isinstance(config, PSABirthRowCropperConfig):
        return PSABirthRowCropperConfig(
            registered_width=config.registered_width,
            registered_height=config.registered_height,
            name_regions=tuple(tuple(item) for item in config.name_regions),
            row_bands=(
                tuple(tuple(item) for item in config.row_bands)
                if config.row_bands is not None
                else None
            ),
            review_on_registration_issue=config.review_on_registration_issue,
        )
    if not isinstance(config, Mapping):
        raise ValueError(
            "config must be PSABirthRowCropperConfig, a mapping, or None"
        )

    allowed = {
        "registered_width",
        "registered_height",
        "name_regions",
        "row_bands",
        "review_on_registration_issue",
    }
    unknown = set(config) - allowed
    if unknown:
        raise ValueError(f"unsupported configuration keys: {sorted(unknown)}")

    values = dict(config)
    if "row_bands" in values and values["row_bands"] is not None:
        bands = values["row_bands"]
        if isinstance(bands, Mapping):
            bands = tuple(
                (name, bounds[0], bounds[1])
                for name, bounds in bands.items()
            )
        values["row_bands"] = tuple(tuple(item) for item in bands)

    if "name_regions" in values:
        regions = values["name_regions"]
        if isinstance(regions, Mapping):
            converted = []
            for name, bounds in regions.items():
                if isinstance(bounds, Mapping):
                    converted.append(
                        (
                            name,
                            bounds["x"],
                            bounds["y"],
                            bounds["width"],
                            bounds["height"],
                        )
                    )
                else:
                    converted.append((name, *tuple(bounds)))
            regions = tuple(converted)
        values["name_regions"] = tuple(tuple(item) for item in regions)

    return PSABirthRowCropperConfig(**values)


def _region_to_pixels(
    x: float,
    y: float,
    width: float,
    height: float,
    image_width: int,
    image_height: int,
) -> tuple[int, int, int, int]:
    left = math.floor(x * image_width)
    top = math.floor(y * image_height)
    right = math.ceil((x + width) * image_width)
    bottom = math.ceil((y + height) * image_height)

    left = max(0, min(left, image_width))
    right = max(0, min(right, image_width))
    top = max(0, min(top, image_height))
    bottom = max(0, min(bottom, image_height))
    return left, top, right, bottom


def _validated_region_bounds(
    left: int,
    top: int,
    right: int,
    bottom: int,
    width: int,
    height: int,
) -> NormalizedBounds | None:
    if width <= 0 or height <= 0 or right <= left or bottom <= top:
        return None
    return NormalizedBounds(
        x=left / float(width),
        y=top / float(height),
        width=(right - left) / float(width),
        height=(bottom - top) / float(height),
    )


def crop_psa_birth_name_rows(
    registered_image: Any,
    registration_metadata: Any = None,
    config: PSABirthRowCropperConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSABirthRowCropperOutput]:
    try:
        resolved = _validate_config(config)
    except (KeyError, TypeError, ValueError):
        return _failure("TARGET_NAME_CELL_CROP_INVALID")

    image = _prepare_image(registered_image)
    if image is None:
        return _failure("REGISTERED_IMAGE_INVALID")

    image_height, image_width = image.shape[:2]
    if (
        image_width != resolved.registered_width
        or image_height != resolved.registered_height
    ):
        return _failure(
            "REGISTERED_DIMENSIONS_MISMATCH",
            registered_width=image_width,
            registered_height=image_height,
        )

    metadata = _resolve_registration_metadata(registration_metadata)
    if registration_metadata is not None and metadata is None:
        return _failure("REGISTRATION_METADATA_INVALID")

    review_propagated = (
        resolved.review_on_registration_issue
        and _is_review_level_registration(metadata)
    )
    boundary_inferred = (
        resolved.review_on_registration_issue
        and _registration_boundary_inferred(metadata)
    )

    regions: list[RegionResult] = []
    crops: dict[str, np.ndarray] = {}
    issues: list[dict[str, str]] = []

    for name, x, y, width, height in resolved.name_regions:
        left, top, right, bottom = _region_to_pixels(
            x,
            y,
            width,
            height,
            image_width,
            image_height,
        )
        bounds = _validated_region_bounds(
            left,
            top,
            right,
            bottom,
            image_width,
            image_height,
        )
        if bounds is None:
            return _failure("TARGET_NAME_CELL_CROP_INVALID")

        crop = np.array(image[top:bottom, left:right], copy=True)
        if crop.size == 0:
            return _failure("TARGET_NAME_CELL_CROP_EMPTY")
        if not np.isfinite(crop).all():
            return _failure("TARGET_NAME_CELL_CROP_INVALID")

        crops[name] = crop
        regions.append(
            RegionResult(
                name=name,
                bounds=bounds,
                success=True,
                confidence=1.0,
                ocr_attempts=0,
                preprocessing_variant=PREPROCESSING_VARIANT,
            )
        )

    if len(regions) != 3 or len(crops) != 3:
        return _failure("TARGET_NAME_CELL_CROP_INVALID")

    if review_propagated:
        issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))
    if boundary_inferred:
        issues.append(_issue("REGISTRATION_BOUNDARY_INFERRED"))

    output = PSABirthRowCropperOutput(
        regions=tuple(regions),
        crops=MappingProxyType(
            {name: crop.copy() for name, crop in crops.items()}
        ),
        registered_width=image_width,
        registered_height=image_height,
    )
    status = "review_required" if issues else "success"

    metrics: dict[str, Any] = {
        "registered_width": image_width,
        "registered_height": image_height,
        "region_count": len(regions),
        "registration_review_propagated": review_propagated,
        "full_row_crop_used": False,
    }
    for name, crop in crops.items():
        metrics[f"{name}_crop_width"] = int(crop.shape[1])
        metrics[f"{name}_crop_height"] = int(crop.shape[0])

    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status=status,
        data=output,
        issues=issues,
        metrics=metrics,
    )
