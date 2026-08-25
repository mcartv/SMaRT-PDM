from __future__ import annotations

import math
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Callable, Iterable, Mapping, Sequence

import numpy as np

from .models import RegionResult
from .psa_birth_row_cropper import PSABirthRowCropperOutput
from .ocr_engine import OCRBinaryUnavailableError, OCRExecutionError, OCRInputError, ocr_image
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_ocr"
REQUIRED_FIELDS = ("child_name", "mother_maiden_name", "father_name")
PREPROCESSING_VARIANT = "registered_whole_row_ocr"


@dataclass(frozen=True)
class PSABirthRowOCRConfig:
    required_fields: tuple[str, ...] = REQUIRED_FIELDS
    preprocessing_variant: str = PREPROCESSING_VARIANT
    strip_outer_whitespace: bool = True

    def __post_init__(self) -> None:
        if tuple(self.required_fields) != REQUIRED_FIELDS:
            raise ValueError("required_fields must remain in the approved deterministic order")
        if self.preprocessing_variant != PREPROCESSING_VARIANT:
            raise ValueError("preprocessing_variant must remain registered_whole_row_ocr")


@dataclass(frozen=True)
class PSABirthRowOCRFieldResult:
    name: str
    raw_text: str
    review_required: bool
    success: bool
    issue_codes: tuple[str, ...]
    preprocessing_variant: str
    ocr_attempts: int


@dataclass(frozen=True)
class PSABirthRowOCROutput:
    fields: tuple[PSABirthRowOCRFieldResult, ...]
    field_count: int


@dataclass(frozen=True)
class PSABirthRowOCRConfigResolved:
    required_fields: tuple[str, ...]
    preprocessing_variant: str
    strip_outer_whitespace: bool


def _issue(code: str) -> dict[str, str]:
    return {"code": code, "stage": STAGE_NAME, "field": ""}


def _failure(code: str, **metrics: Any) -> StageResult[PSABirthRowOCROutput]:
    return StageResult(
        stage=STAGE_NAME,
        success=False,
        status="failed",
        data=None,
        issues=[_issue(code)],
        metrics=dict(metrics),
    )


def _resolve_config(config: PSABirthRowOCRConfig | Mapping[str, Any] | None) -> PSABirthRowOCRConfigResolved:
    if config is None:
        resolved = PSABirthRowOCRConfig()
    elif isinstance(config, PSABirthRowOCRConfig):
        resolved = PSABirthRowOCRConfig(
            required_fields=tuple(config.required_fields),
            preprocessing_variant=config.preprocessing_variant,
            strip_outer_whitespace=config.strip_outer_whitespace,
        )
    elif isinstance(config, Mapping):
        allowed = {"required_fields", "preprocessing_variant", "strip_outer_whitespace"}
        unknown = set(config) - allowed
        if unknown:
            raise ValueError(f"unsupported configuration keys: {sorted(unknown)}")
        values = dict(config)
        if "required_fields" in values and tuple(values["required_fields"]) != REQUIRED_FIELDS:
            raise ValueError("required_fields must remain in the approved deterministic order")
        if "preprocessing_variant" in values and values["preprocessing_variant"] != PREPROCESSING_VARIANT:
            raise ValueError("preprocessing_variant must remain registered_whole_row_ocr")
        resolved = PSABirthRowOCRConfig(**values)
    else:
        raise ValueError("config must be PSABirthRowOCRConfig, a mapping, or None")
    return PSABirthRowOCRConfigResolved(
        required_fields=tuple(resolved.required_fields),
        preprocessing_variant=resolved.preprocessing_variant,
        strip_outer_whitespace=bool(resolved.strip_outer_whitespace),
    )


def _resolve_crop_output(crop_output: Any) -> PSABirthRowCropperOutput | None:
    if isinstance(crop_output, PSABirthRowCropperOutput):
        return crop_output
    if hasattr(crop_output, "data") and isinstance(getattr(crop_output, "data"), PSABirthRowCropperOutput):
        return getattr(crop_output, "data")
    return None


def _prepare_crop_array(value: Any) -> np.ndarray | None:
    if not isinstance(value, np.ndarray) or value.dtype != np.uint8:
        return None
    if value.ndim not in (2, 3):
        return None
    if value.ndim == 3 and value.shape[2] not in (3, 4):
        return None
    if value.size == 0 or value.shape[0] <= 0 or value.shape[1] <= 0:
        return None
    return np.ascontiguousarray(value)


def _normalize_text(text: Any, strip_outer_whitespace: bool) -> str:
    if text is None:
        cleaned = ""
    elif isinstance(text, str):
        cleaned = text
    else:
        cleaned = str(text)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    if strip_outer_whitespace:
        cleaned = cleaned.strip()
    return cleaned


def _default_ocr_reader(image: np.ndarray) -> str:
    return ocr_image(image)


def extract_psa_birth_row_text(
    crop_output: Any,
    ocr_reader: Callable[[np.ndarray], Any] | None = None,
    config: PSABirthRowOCRConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSABirthRowOCROutput]:
    try:
        resolved = _resolve_config(config)
    except (KeyError, TypeError, ValueError):
        return _failure("ROW_CROP_INVALID")

    resolved_crop_output = _resolve_crop_output(crop_output)
    if resolved_crop_output is None:
        return _failure("ROW_CROP_OUTPUT_INVALID")

    if ocr_reader is not None and not callable(ocr_reader):
        return _failure("OCR_READER_INVALID")
    reader = ocr_reader or _default_ocr_reader

    regions = tuple(resolved_crop_output.regions)
    crops = dict(resolved_crop_output.crops)
    required = resolved.required_fields
    if len(regions) != 3 or set(region.name for region in regions) != set(required):
        return _failure("REQUIRED_ROW_CROP_MISSING")
    if set(crops) != set(required):
        return _failure("REQUIRED_ROW_CROP_MISSING")

    ordered_fields = [next(region for region in regions if region.name == name) for name in required]
    results: list[PSABirthRowOCRFieldResult] = []
    issues: list[dict[str, str]] = []
    successful_ocr_count = 0
    failed_ocr_count = 0
    empty_text_count = 0
    total_ocr_attempts = 0
    partial_failure = False

    for region in ordered_fields:
        crop = _prepare_crop_array(crops.get(region.name))
        if crop is None:
            return _failure("ROW_CROP_INVALID")
        total_ocr_attempts += 1
        try:
            text = reader(crop.copy())
        except (OCRInputError, OCRBinaryUnavailableError, OCRExecutionError, Exception):
            failed_ocr_count += 1
            partial_failure = True
            results.append(
                PSABirthRowOCRFieldResult(
                    name=region.name,
                    raw_text="",
                    review_required=True,
                    success=False,
                    issue_codes=("OCR_EXECUTION_FAILED",),
                    preprocessing_variant=resolved.preprocessing_variant,
                    ocr_attempts=1,
                )
            )
            continue

        raw_text = _normalize_text(text, resolved.strip_outer_whitespace)
        field_issues = []
        if raw_text == "":
            field_issues.append("OCR_TEXT_EMPTY")
            empty_text_count += 1
        successful_ocr_count += 1
        results.append(
            PSABirthRowOCRFieldResult(
                name=region.name,
                raw_text=raw_text,
                review_required=True,
                success=True,
                issue_codes=tuple(field_issues),
                preprocessing_variant=resolved.preprocessing_variant,
                ocr_attempts=1,
            )
        )

    if successful_ocr_count == 0 and failed_ocr_count > 0:
        for field in results:
            pass
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=PSABirthRowOCROutput(fields=tuple(results), field_count=len(results)),
            issues=[_issue("OCR_ALL_FIELDS_FAILED")],
            metrics={
                "field_count": len(results),
                "successful_ocr_count": successful_ocr_count,
                "failed_ocr_count": failed_ocr_count,
                "empty_text_count": empty_text_count,
                "total_ocr_attempts": total_ocr_attempts,
                "manual_review_required": True,
                "upstream_review_propagated": False,
            },
        )

    if failed_ocr_count > 0:
        issues.append(_issue("OCR_PARTIAL_FAILURE"))
    if empty_text_count > 0:
        issues.append(_issue("OCR_TEXT_EMPTY"))

    upstream_review = False
    if hasattr(crop_output, "status") and getattr(crop_output, "status") == "review_required":
        upstream_review = True
        issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))
    elif hasattr(crop_output, "issues"):
        upstream_codes = {issue.get("code") for issue in getattr(crop_output, "issues", [])}
        if "REGISTRATION_REVIEW_PROPAGATED" in upstream_codes or "REGISTRATION_BOUNDARY_INFERRED" in upstream_codes:
            upstream_review = True
            issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))

    issues.append(_issue("OCR_MANUAL_REVIEW_REQUIRED"))

    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required",
        data=PSABirthRowOCROutput(fields=tuple(results), field_count=len(results)),
        issues=issues,
        metrics={
            "field_count": len(results),
            "successful_ocr_count": successful_ocr_count,
            "failed_ocr_count": failed_ocr_count,
            "empty_text_count": empty_text_count,
            "total_ocr_attempts": total_ocr_attempts,
            "manual_review_required": True,
            "upstream_review_propagated": upstream_review,
        },
    )
