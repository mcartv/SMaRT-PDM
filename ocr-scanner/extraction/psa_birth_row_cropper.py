from __future__ import annotations

import math
from dataclasses import dataclass, field
from numbers import Real
from types import MappingProxyType
from typing import Any, Mapping, Optional, Sequence

import numpy as np

from .geometry import NormalizedBounds
from .models import RegionResult
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_cropper"
REGISTERED_WIDTH = 1400
REGISTERED_HEIGHT = 1375


def _default_row_bands() -> tuple[tuple[str, float, float], ...]:
    return (
        ("child_name", 0.000, 0.140),
        ("mother_maiden_name", 0.408, 0.493),
        ("father_name", 0.794, 0.863),
    )


@dataclass(frozen=True)
class PSABirthRowCropperConfig:
    registered_width: int = REGISTERED_WIDTH
    registered_height: int = REGISTERED_HEIGHT
    row_bands: tuple[tuple[str, float, float], ...] = field(default_factory=_default_row_bands)
    review_on_registration_issue: bool = True

    def __post_init__(self) -> None:
        if self.registered_width != REGISTERED_WIDTH or self.registered_height != REGISTERED_HEIGHT:
            raise ValueError("registered dimensions must remain at 1400 by 1375")
        if any(isinstance(value, bool) or not isinstance(value, int) or value <= 0 for value in (self.registered_width, self.registered_height)):
            raise ValueError("registered dimensions must be positive integers")
        copied_bands = tuple(tuple(item) for item in self.row_bands)
        if len(copied_bands) != 3:
            raise ValueError("row_bands must contain exactly three entries")
        names: set[str] = set()
        for item in copied_bands:
            if len(item) != 3:
                raise ValueError("each row band must contain name, top, and bottom")
            name, top, bottom = item
            if not isinstance(name, str) or not name or name in names:
                raise ValueError("row band names must be unique non-empty strings")
            names.add(name)
            for value in (top, bottom):
                if isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value):
                    raise ValueError("row band bounds must be finite numbers")
            if not 0.0 <= top <= bottom <= 1.0:
                raise ValueError("row band bounds must be ordered within 0.0 and 1.0")
        object.__setattr__(self, "row_bands", copied_bands)


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
            issues=tuple(dict(issue) for issue in getattr(registration_metadata, "issues", [])),
            transformation_metadata=getattr(registration_metadata, "transformation_metadata", None),
        )
    if hasattr(registration_metadata, "status") and hasattr(registration_metadata, "issues"):
        return PSABirthRowCropperMetadata(
            status=str(getattr(registration_metadata, "status", "")),
            issues=tuple(dict(issue) for issue in getattr(registration_metadata, "issues", [])),
            transformation_metadata=registration_metadata,
        )
    if isinstance(registration_metadata, Mapping):
        return PSABirthRowCropperMetadata(
            status=str(registration_metadata.get("status", "")),
            issues=tuple(dict(issue) for issue in registration_metadata.get("issues", [])),
            transformation_metadata=registration_metadata.get("transformation_metadata"),
        )
    return None


def _is_review_level_registration(metadata: PSABirthRowCropperMetadata | None) -> bool:
    if metadata is None:
        return False
    if metadata.status == "review_required":
        return True
    issues = {issue.get("code") for issue in metadata.issues}
    return bool({"REGISTRATION_REVIEW_PROPAGATED", "REGISTRATION_BOUNDARY_INFERRED"} & issues)


def _registration_boundary_inferred(metadata: PSABirthRowCropperMetadata | None) -> bool:
    if metadata is None:
        return False
    if metadata.status == "review_required":
        return True
    issues = {issue.get("code") for issue in metadata.issues}
    return "REGISTRATION_BOUNDARY_INFERRED" in issues


def _prepare_image(registered_image: Any) -> np.ndarray | None:
    if not isinstance(registered_image, np.ndarray) or registered_image.dtype != np.uint8:
        return None
    if registered_image.ndim == 2:
        return registered_image
    if registered_image.ndim == 3 and registered_image.shape[2] in (3, 4):
        return registered_image
    return None


def _validate_config(config: PSABirthRowCropperConfig | Mapping[str, Any] | None) -> PSABirthRowCropperConfig:
    if config is None:
        return PSABirthRowCropperConfig()
    if isinstance(config, PSABirthRowCropperConfig):
        return PSABirthRowCropperConfig(
            registered_width=config.registered_width,
            registered_height=config.registered_height,
            row_bands=tuple(tuple(item) for item in config.row_bands),
            review_on_registration_issue=config.review_on_registration_issue,
        )
    if not isinstance(config, Mapping):
        raise ValueError("config must be PSABirthRowCropperConfig, a mapping, or None")
    allowed = {"registered_width", "registered_height", "row_bands", "review_on_registration_issue"}
    unknown = set(config) - allowed
    if unknown:
        raise ValueError(f"unsupported configuration keys: {sorted(unknown)}")
    values = dict(config)
    if "row_bands" in values:
        bands = values["row_bands"]
        if isinstance(bands, Mapping):
            bands = tuple((name, bounds[0], bounds[1]) for name, bounds in bands.items())
        values["row_bands"] = tuple(tuple(item) for item in bands)
    return PSABirthRowCropperConfig(**values)


def _row_to_pixels(start: float, end: float, dimension: int) -> tuple[int, int]:
    top = math.floor(start * dimension)
    bottom = math.ceil(end * dimension)
    top = max(0, min(top, dimension))
    bottom = max(0, min(bottom, dimension))
    return top, bottom


def _validated_region_bounds(top: int, bottom: int, width: int, height: int) -> NormalizedBounds | None:
    if width <= 0 or height <= 0:
        return None
    return NormalizedBounds(x=0.0, y=top / float(height), width=1.0, height=(bottom - top) / float(height))


def crop_psa_birth_name_rows(
    registered_image: Any,
    registration_metadata: Any = None,
    config: PSABirthRowCropperConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSABirthRowCropperOutput]:
    try:
        resolved = _validate_config(config)
    except (KeyError, TypeError, ValueError):
        return _failure("TARGET_ROW_CROP_INVALID")

    image = _prepare_image(registered_image)
    if image is None:
        return _failure("REGISTERED_IMAGE_INVALID")

    height, width = image.shape[:2]
    if width != resolved.registered_width or height != resolved.registered_height:
        return _failure(
            "REGISTERED_DIMENSIONS_MISMATCH",
            registered_width=width,
            registered_height=height,
        )

    metadata = _resolve_registration_metadata(registration_metadata)
    if registration_metadata is not None and metadata is None:
        return _failure("REGISTRATION_METADATA_INVALID")

    review_propagated = _is_review_level_registration(metadata)
    boundary_inferred = _registration_boundary_inferred(metadata)

    regions: list[RegionResult] = []
    crops: dict[str, np.ndarray] = {}
    issues: list[dict[str, str]] = []
    empty_crop = False

    for name, start, end in resolved.row_bands:
        top_px, bottom_px = _row_to_pixels(start, end, height)
        if top_px < 0 or bottom_px > height:
            return _failure("TARGET_REGION_OUT_OF_BOUNDS")
        if bottom_px <= top_px:
            empty_crop = True
            break
        bounds = _validated_region_bounds(top_px, bottom_px, width, height)
        if bounds is None:
            return _failure("TARGET_ROW_CROP_INVALID")
        crop = np.array(image[top_px:bottom_px, 0:width], copy=True)
        if crop.size == 0:
            empty_crop = True
            break
        if not np.isfinite(crop).all():
            return _failure("TARGET_ROW_CROP_INVALID")
        crops[name] = crop
        regions.append(
            RegionResult(
                name=name,
                bounds=bounds,
                success=True,
                confidence=1.0,
                ocr_attempts=0,
                preprocessing_variant="registered_whole_row",
            )
        )

    if empty_crop:
        return _failure("TARGET_ROW_CROP_EMPTY")
    if len(regions) != 3:
        return _failure("TARGET_ROW_CROP_INVALID")

    if review_propagated:
        issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))
    if boundary_inferred:
        issues.append(_issue("REGISTRATION_BOUNDARY_INFERRED"))

    output = PSABirthRowCropperOutput(
        regions=tuple(regions),
        crops=MappingProxyType({name: crop.copy() for name, crop in crops.items()}),
        registered_width=width,
        registered_height=height,
    )
    status = "review_required" if issues else "success"
    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status=status,
        data=output,
        issues=issues,
        metrics={
            "registered_width": width,
            "registered_height": height,
            "region_count": len(regions),
            "child_crop_width": int(crops["child_name"].shape[1]),
            "child_crop_height": int(crops["child_name"].shape[0]),
            "mother_crop_width": int(crops["mother_maiden_name"].shape[1]),
            "mother_crop_height": int(crops["mother_maiden_name"].shape[0]),
            "father_crop_width": int(crops["father_name"].shape[1]),
            "father_crop_height": int(crops["father_name"].shape[0]),
            "registration_review_propagated": review_propagated,
        },
    )
