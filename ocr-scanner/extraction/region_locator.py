from __future__ import annotations

import math
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Mapping, Optional, Sequence

from .geometry import NormalizedBounds
from .models import AnchorResult, RegionResult
from .stage_result import StageResult


SUPPORTED_FIELDS = ("child_name", "mother_maiden_name", "father_name")

# Coordinates are relative to a perspective-corrected, orientation-normalized page.
BIRTH_REGION_FALLBACKS: Mapping[str, NormalizedBounds] = MappingProxyType(
    {
        "child_name": NormalizedBounds(0.26, 0.195, 0.35, 0.020),
        "mother_maiden_name": NormalizedBounds(0.26, 0.345, 0.35, 0.022),
        "father_name": NormalizedBounds(0.26, 0.475, 0.35, 0.022),
    }
)


class _RegionOutOfBounds(ValueError):
    pass


@dataclass(frozen=True)
class RegionLocatorConfig:
    confidence_threshold: float = 0.65
    fallback_confidence: float = 0.40
    horizontal_gap: float = 0.01
    fallbacks: Mapping[str, Optional[NormalizedBounds]] = field(
        default_factory=lambda: dict(BIRTH_REGION_FALLBACKS)
    )

    def __post_init__(self) -> None:
        for name, value in (
            ("confidence_threshold", self.confidence_threshold),
            ("fallback_confidence", self.fallback_confidence),
            ("horizontal_gap", self.horizontal_gap),
        ):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{name} must be numeric")
            if not math.isfinite(value) or value < 0.0 or value > 1.0:
                raise ValueError(f"{name} must be finite and between 0.0 and 1.0")

        copied_fallbacks = dict(self.fallbacks)
        unknown_fields = set(copied_fallbacks) - set(SUPPORTED_FIELDS)
        if unknown_fields:
            raise ValueError(f"Unsupported fallback fields: {sorted(unknown_fields)}")
        for field_name in SUPPORTED_FIELDS:
            fallback = copied_fallbacks.get(field_name)
            if fallback is not None and not isinstance(fallback, NormalizedBounds):
                raise ValueError(f"Fallback for {field_name} must be NormalizedBounds or None")
        object.__setattr__(self, "fallbacks", MappingProxyType(copied_fallbacks))


def _build_config(overrides: RegionLocatorConfig | Mapping[str, Any] | None) -> RegionLocatorConfig:
    if overrides is None:
        return RegionLocatorConfig()
    if isinstance(overrides, RegionLocatorConfig):
        return RegionLocatorConfig(
            confidence_threshold=overrides.confidence_threshold,
            fallback_confidence=overrides.fallback_confidence,
            horizontal_gap=overrides.horizontal_gap,
            fallbacks=dict(overrides.fallbacks),
        )
    if not isinstance(overrides, Mapping):
        raise ValueError("config must be RegionLocatorConfig, a mapping, or None")

    allowed_keys = {"confidence_threshold", "fallback_confidence", "horizontal_gap", "fallbacks"}
    unknown_keys = set(overrides) - allowed_keys
    if unknown_keys:
        raise ValueError(f"Unsupported configuration keys: {sorted(unknown_keys)}")

    fallback_values = dict(BIRTH_REGION_FALLBACKS)
    fallback_overrides = overrides.get("fallbacks", {})
    if not isinstance(fallback_overrides, Mapping):
        raise ValueError("fallbacks override must be a mapping")
    for field_name, value in fallback_overrides.items():
        if field_name not in SUPPORTED_FIELDS:
            raise ValueError(f"Unsupported fallback field: {field_name}")
        if isinstance(value, Mapping):
            value = NormalizedBounds.from_dict(dict(value))
        fallback_values[field_name] = value

    return RegionLocatorConfig(
        confidence_threshold=overrides.get("confidence_threshold", 0.65),
        fallback_confidence=overrides.get("fallback_confidence", 0.40),
        horizontal_gap=overrides.get("horizontal_gap", 0.01),
        fallbacks=fallback_values,
    )


def _issue(code: str, field_name: str = "") -> dict[str, str]:
    return {"code": code, "stage": "region_extraction", "field": field_name}


def _inside_document(bounds: NormalizedBounds, document: NormalizedBounds) -> bool:
    return (
        bounds.x >= document.x
        and bounds.y >= document.y
        and bounds.x + bounds.width <= document.x + document.width
        and bounds.y + bounds.height <= document.y + document.height
    )


def _page_relative_bounds(bounds: NormalizedBounds, document: NormalizedBounds) -> NormalizedBounds:
    return NormalizedBounds(
        x=document.x + bounds.x * document.width,
        y=document.y + bounds.y * document.height,
        width=bounds.width * document.width,
        height=bounds.height * document.height,
    )


def _anchor_relative_bounds(
    anchor: AnchorResult,
    field_name: str,
    document: NormalizedBounds,
    config: RegionLocatorConfig,
) -> NormalizedBounds:
    template = config.fallbacks.get(field_name) or BIRTH_REGION_FALLBACKS[field_name]
    x = anchor.bounds.x + anchor.bounds.width + config.horizontal_gap * document.width
    y = anchor.bounds.y
    width = template.width * document.width
    height = template.height * document.height
    if (
        x < document.x
        or y < document.y
        or x + width > document.x + document.width
        or y + height > document.y + document.height
    ):
        raise _RegionOutOfBounds
    return NormalizedBounds(
        x=x,
        y=y,
        width=width,
        height=height,
    )


def locate_birth_regions(
    anchors: Sequence[AnchorResult],
    document_bounds: NormalizedBounds,
    config: RegionLocatorConfig | Mapping[str, Any] | None = None,
) -> StageResult[list[RegionResult]]:
    """Convert semantic PSA birth-certificate anchors into normalized crop regions."""
    if (
        not isinstance(document_bounds, NormalizedBounds)
        or document_bounds.width == 0.0
        or document_bounds.height == 0.0
    ):
        return StageResult(
            stage="region_extraction",
            success=False,
            status="failed",
            data=[],
            issues=[_issue("DOCUMENT_BOUNDS_INVALID")],
            metrics={"region_count": 0, "fallback_count": 0, "issue_count": 1},
        )

    resolved_config = _build_config(config)
    anchors_by_field = {
        field_name: [anchor for anchor in anchors if anchor.name == field_name]
        for field_name in SUPPORTED_FIELDS
    }
    regions: list[RegionResult] = []
    issues: list[dict[str, str]] = []
    fallback_count = 0

    for field_name in SUPPORTED_FIELDS:
        field_anchors = anchors_by_field[field_name]
        use_fallback = False

        if not field_anchors:
            issues.append(_issue("ANCHOR_MISSING", field_name))
            use_fallback = True
        elif len(field_anchors) > 1:
            issues.append(_issue("ANCHOR_CONFLICT", field_name))
            use_fallback = True
        else:
            anchor = field_anchors[0]
            confidence_valid = (
                isinstance(anchor.confidence, (int, float))
                and not isinstance(anchor.confidence, bool)
                and math.isfinite(anchor.confidence)
                and 0.0 <= anchor.confidence <= 1.0
            )
            if not confidence_valid or not isinstance(anchor.bounds, NormalizedBounds):
                issues.append(_issue("REGION_GEOMETRY_INVALID", field_name))
                use_fallback = True
            elif not anchor.success or anchor.confidence < resolved_config.confidence_threshold:
                issues.append(_issue("ANCHOR_LOW_CONFIDENCE", field_name))
                use_fallback = True
            else:
                try:
                    bounds = _anchor_relative_bounds(anchor, field_name, document_bounds, resolved_config)
                except _RegionOutOfBounds:
                    issues.append(_issue("REGION_OUT_OF_BOUNDS", field_name))
                    use_fallback = True
                except (TypeError, ValueError):
                    issues.append(_issue("REGION_GEOMETRY_INVALID", field_name))
                    use_fallback = True
                else:
                    if not _inside_document(bounds, document_bounds):
                        issues.append(_issue("REGION_OUT_OF_BOUNDS", field_name))
                        use_fallback = True
                    else:
                        regions.append(
                            RegionResult(
                                name=field_name,
                                bounds=bounds,
                                success=True,
                                confidence=float(anchor.confidence),
                                ocr_attempts=0,
                                preprocessing_variant="anchor_relative",
                            )
                        )

        if use_fallback:
            fallback = resolved_config.fallbacks.get(field_name)
            if fallback is None:
                issues.append(_issue("REGION_GEOMETRY_INVALID", field_name))
                continue
            try:
                fallback_bounds = _page_relative_bounds(fallback, document_bounds)
            except (TypeError, ValueError):
                issues.append(_issue("REGION_GEOMETRY_INVALID", field_name))
                continue
            if not _inside_document(fallback_bounds, document_bounds):
                issues.append(_issue("REGION_GEOMETRY_INVALID", field_name))
                continue
            issues.append(_issue("FALLBACK_REGION_USED", field_name))
            fallback_count += 1
            regions.append(
                RegionResult(
                    name=field_name,
                    bounds=fallback_bounds,
                    success=True,
                    confidence=float(resolved_config.fallback_confidence),
                    ocr_attempts=0,
                    preprocessing_variant="normalized_fallback",
                )
            )

    success = len(regions) == len(SUPPORTED_FIELDS)
    status = "failed" if not success else "review_required" if issues else "success"
    return StageResult(
        stage="region_extraction",
        success=success,
        status=status,
        data=regions,
        issues=issues,
        metrics={
            "region_count": len(regions),
            "fallback_count": fallback_count,
            "issue_count": len(issues),
        },
    )
