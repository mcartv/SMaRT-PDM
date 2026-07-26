from __future__ import annotations

import re
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Callable, Mapping

import cv2
import numpy as np

from .ocr_engine import (
    OCRBinaryUnavailableError,
    OCRExecutionError,
    OCRInputError,
    ocr_image,
)
from .psa_birth_row_cropper import PSABirthRowCropperOutput
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_ocr"
REQUIRED_FIELDS = ("child_name", "mother_maiden_name", "father_name")
PREPROCESSING_VARIANT = "registered_name_cell_ocr"

_NAME_TOKEN_PATTERN = re.compile(
    r"[A-Za-zÀ-ÖØ-öø-ÿÑñ]+(?:[.'’\-][A-Za-zÀ-ÖØ-öø-ÿÑñ]+)*\.?"
)
_SPACE_PATTERN = re.compile(r"\s+")

_LABEL_WORDS = frozenset(
    {
        "name",
        "first",
        "middle",
        "last",
        "maiden",
        "mother",
        "mothers",
        "father",
        "fathers",
        "child",
        "item",
        "sex",
        "gender",
        "date",
        "birth",
        "place",
        "citizenship",
        "religion",
        "occupation",
        "age",
        "residence",
        "address",
        "house",
        "street",
        "barangay",
        "hospital",
        "clinic",
        "institution",
        "city",
        "municipality",
        "province",
        "country",
        "signature",
        "printed",
        "form",
        "number",
        "month",
        "day",
        "year",
    }
)


@dataclass(frozen=True)
class PSABirthRowOCRConfig:
    required_fields: tuple[str, ...] = REQUIRED_FIELDS
    preprocessing_variant: str = PREPROCESSING_VARIANT
    strip_outer_whitespace: bool = True
    minimum_alpha_characters: int = 4
    maximum_name_tokens: int = 8
    maximum_name_characters: int = 120
    target_height: int = 120
    blank_ink_ratio_threshold: float = 0.0025

    def __post_init__(self) -> None:
        if tuple(self.required_fields) != REQUIRED_FIELDS:
            raise ValueError(
                "required_fields must remain in the approved deterministic order"
            )
        if self.preprocessing_variant not in {
            PREPROCESSING_VARIANT,
            "registered_whole_row_ocr",
        }:
            raise ValueError(
                "preprocessing_variant must use the approved birth OCR path"
            )
        object.__setattr__(
            self,
            "preprocessing_variant",
            PREPROCESSING_VARIANT,
        )
        for name in (
            "minimum_alpha_characters",
            "maximum_name_tokens",
            "maximum_name_characters",
            "target_height",
        ):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise ValueError(f"{name} must be a positive integer")
        if not 0.0 <= self.blank_ink_ratio_threshold <= 0.1:
            raise ValueError("blank_ink_ratio_threshold must be between 0.0 and 0.1")


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
    minimum_alpha_characters: int
    maximum_name_tokens: int
    maximum_name_characters: int
    target_height: int
    blank_ink_ratio_threshold: float


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


def _resolve_config(
    config: PSABirthRowOCRConfig | Mapping[str, Any] | None,
) -> PSABirthRowOCRConfigResolved:
    if config is None:
        resolved = PSABirthRowOCRConfig()
    elif isinstance(config, PSABirthRowOCRConfig):
        resolved = PSABirthRowOCRConfig(
            required_fields=tuple(config.required_fields),
            preprocessing_variant=config.preprocessing_variant,
            strip_outer_whitespace=config.strip_outer_whitespace,
            minimum_alpha_characters=config.minimum_alpha_characters,
            maximum_name_tokens=config.maximum_name_tokens,
            maximum_name_characters=config.maximum_name_characters,
            target_height=config.target_height,
            blank_ink_ratio_threshold=config.blank_ink_ratio_threshold,
        )
    elif isinstance(config, Mapping):
        allowed = {
            "required_fields",
            "preprocessing_variant",
            "strip_outer_whitespace",
            "minimum_alpha_characters",
            "maximum_name_tokens",
            "maximum_name_characters",
            "target_height",
            "blank_ink_ratio_threshold",
        }
        unknown = set(config) - allowed
        if unknown:
            raise ValueError(f"unsupported configuration keys: {sorted(unknown)}")
        values = dict(config)
        if "required_fields" in values:
            values["required_fields"] = tuple(values["required_fields"])
        resolved = PSABirthRowOCRConfig(**values)
    else:
        raise ValueError("config must be PSABirthRowOCRConfig, a mapping, or None")

    return PSABirthRowOCRConfigResolved(
        required_fields=tuple(resolved.required_fields),
        preprocessing_variant=resolved.preprocessing_variant,
        strip_outer_whitespace=bool(resolved.strip_outer_whitespace),
        minimum_alpha_characters=resolved.minimum_alpha_characters,
        maximum_name_tokens=resolved.maximum_name_tokens,
        maximum_name_characters=resolved.maximum_name_characters,
        target_height=resolved.target_height,
        blank_ink_ratio_threshold=float(resolved.blank_ink_ratio_threshold),
    )


def _resolve_crop_output(crop_output: Any) -> PSABirthRowCropperOutput | None:
    if isinstance(crop_output, PSABirthRowCropperOutput):
        return crop_output
    if hasattr(crop_output, "data") and isinstance(
        getattr(crop_output, "data"),
        PSABirthRowCropperOutput,
    ):
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


def _grayscale(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image.copy()
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _remove_form_lines(binary: np.ndarray) -> np.ndarray:
    inverted = cv2.bitwise_not(binary)
    height, width = inverted.shape[:2]

    horizontal_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (max(18, width // 14), 1),
    )
    vertical_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (1, max(10, height // 2)),
    )
    horizontal = cv2.morphologyEx(
        inverted,
        cv2.MORPH_OPEN,
        horizontal_kernel,
    )
    vertical = cv2.morphologyEx(
        inverted,
        cv2.MORPH_OPEN,
        vertical_kernel,
    )
    lines = cv2.bitwise_or(horizontal, vertical)
    text_only = cv2.subtract(inverted, lines)
    return cv2.bitwise_not(text_only)


def _preprocess_name_cell(
    crop: np.ndarray,
    target_height: int,
) -> tuple[np.ndarray, float]:
    gray = _grayscale(crop)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    if int(gray.max()) - int(gray.min()) >= 8:
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    _, binary = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    dark_pixels = int(np.count_nonzero(binary < 180))
    ink_ratio = dark_pixels / float(binary.size or 1)
    cleaned = _remove_form_lines(binary)

    height, width = cleaned.shape[:2]
    if height < target_height:
        scale = target_height / float(height)
        cleaned = cv2.resize(
            cleaned,
            (max(1, int(round(width * scale))), target_height),
            interpolation=cv2.INTER_CUBIC,
        )

    cleaned = cv2.copyMakeBorder(
        cleaned,
        12,
        12,
        18,
        18,
        cv2.BORDER_CONSTANT,
        value=255,
    )
    return np.ascontiguousarray(cleaned), ink_ratio


def _normalize_source_text(text: Any, strip_outer_whitespace: bool) -> str:
    if text is None:
        normalized = ""
    elif isinstance(text, str):
        normalized = text
    else:
        normalized = str(text)

    normalized = (
        normalized.replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("–", "-")
        .replace("—", "-")
        .replace("`", "'")
        .replace("‘", "'")
        .replace("’", "'")
    )
    return normalized.strip() if strip_outer_whitespace else normalized


def _clean_name_candidate(
    text: Any,
    config: PSABirthRowOCRConfigResolved,
) -> tuple[str, tuple[str, ...], int]:
    source = _normalize_source_text(text, config.strip_outer_whitespace)
    if not source:
        return "", ("OCR_TEXT_EMPTY",), 0

    candidates: list[tuple[int, int, str, int]] = []
    removed_label_count = 0

    for line_index, line in enumerate(source.split("\n")):
        if not line.strip():
            continue

        digit_count = sum(character.isdigit() for character in line)
        raw_tokens = _NAME_TOKEN_PATTERN.findall(line)
        accepted_tokens: list[str] = []
        line_removed_labels = 0

        for token in raw_tokens:
            token = token.strip("'’ -")
            if not token:
                continue
            if token.casefold() in _LABEL_WORDS:
                line_removed_labels += 1
                continue
            alpha_count = sum(character.isalpha() for character in token)
            is_initial = alpha_count == 1 and token.endswith(".")
            if alpha_count < 2 and not is_initial:
                continue
            if len(token) > 35:
                continue
            accepted_tokens.append(token)

        removed_label_count += line_removed_labels
        if not accepted_tokens:
            continue

        accepted_tokens = accepted_tokens[: config.maximum_name_tokens]
        candidate = _SPACE_PATTERN.sub(" ", " ".join(accepted_tokens)).strip()
        alpha_count = sum(character.isalpha() for character in candidate)
        if alpha_count < config.minimum_alpha_characters:
            continue
        if len(candidate) > config.maximum_name_characters:
            candidate = candidate[: config.maximum_name_characters].rstrip()

        score = (
            alpha_count
            + len(accepted_tokens) * 8
            - digit_count * 12
            - line_removed_labels * 3
        )
        candidates.append((score, -line_index, candidate, len(accepted_tokens)))

    if not candidates:
        issues = ["NAME_TEXT_INVALID"]
        if removed_label_count:
            issues.append("FORM_LABEL_TEXT_REMOVED")
        return "", tuple(issues), 0

    candidates.sort(reverse=True)
    _score, _line_order, selected, token_count = candidates[0]
    issues: list[str] = []
    if removed_label_count:
        issues.append("FORM_LABEL_TEXT_REMOVED")
    if token_count == 1:
        issues.append("NAME_TOKEN_COUNT_LOW")
    return selected, tuple(issues), token_count


def _default_ocr_reader(image: np.ndarray) -> str:
    return ocr_image(image)


def extract_psa_birth_row_text(
    crop_output: Any,
    ocr_reader: Callable[[np.ndarray], Any] | None = None,
    config: PSABirthRowOCRConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSABirthRowOCROutput]:
    stage_started = perf_counter()
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

    ordered_regions = [
        next(region for region in regions if region.name == name)
        for name in required
    ]

    results: list[PSABirthRowOCRFieldResult] = []
    issues: list[dict[str, str]] = []
    successful_field_count = 0
    failed_field_count = 0
    blank_father_count = 0
    total_ocr_attempts = 0
    preprocessing_seconds = 0.0
    ocr_seconds = 0.0
    validation_seconds = 0.0

    for region in ordered_regions:
        crop = _prepare_crop_array(crops.get(region.name))
        if crop is None:
            return _failure("ROW_CROP_INVALID")

        preprocess_started = perf_counter()
        processed, ink_ratio = _preprocess_name_cell(
            crop.copy(),
            resolved.target_height,
        )
        preprocessing_seconds += perf_counter() - preprocess_started

        total_ocr_attempts += 1
        ocr_started = perf_counter()
        try:
            source_text = reader(processed.copy())
        except (OCRInputError, OCRBinaryUnavailableError, OCRExecutionError, Exception):
            ocr_seconds += perf_counter() - ocr_started
            failed_field_count += 1
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
        ocr_seconds += perf_counter() - ocr_started

        validation_started = perf_counter()
        cleaned_text, field_issue_codes, _token_count = _clean_name_candidate(
            source_text,
            resolved,
        )
        validation_seconds += perf_counter() - validation_started

        if not cleaned_text:
            if (
                region.name == "father_name"
                and ink_ratio <= resolved.blank_ink_ratio_threshold
            ):
                blank_father_count += 1
                successful_field_count += 1
                results.append(
                    PSABirthRowOCRFieldResult(
                        name=region.name,
                        raw_text="",
                        review_required=True,
                        success=True,
                        issue_codes=("FATHER_SECTION_BLANK",),
                        preprocessing_variant=resolved.preprocessing_variant,
                        ocr_attempts=1,
                    )
                )
            else:
                failed_field_count += 1
                results.append(
                    PSABirthRowOCRFieldResult(
                        name=region.name,
                        raw_text="",
                        review_required=True,
                        success=False,
                        issue_codes=field_issue_codes or ("NAME_TEXT_INVALID",),
                        preprocessing_variant=resolved.preprocessing_variant,
                        ocr_attempts=1,
                    )
                )
            continue

        successful_field_count += 1
        results.append(
            PSABirthRowOCRFieldResult(
                name=region.name,
                raw_text=cleaned_text,
                review_required=True,
                success=True,
                issue_codes=field_issue_codes,
                preprocessing_variant=resolved.preprocessing_variant,
                ocr_attempts=1,
            )
        )

    if successful_field_count == 0:
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=PSABirthRowOCROutput(
                fields=tuple(results),
                field_count=len(results),
            ),
            issues=[_issue("OCR_ALL_FIELDS_FAILED")],
            metrics={
                "field_count": len(results),
                "successful_field_count": successful_field_count,
                "failed_field_count": failed_field_count,
                "blank_father_count": blank_father_count,
                "total_ocr_attempts": total_ocr_attempts,
                "preprocessing_seconds": round(preprocessing_seconds, 6),
                "ocr_seconds": round(ocr_seconds, 6),
                "validation_seconds": round(validation_seconds, 6),
                "total_processing_seconds": round(
                    perf_counter() - stage_started,
                    6,
                ),
                "manual_review_required": True,
                "full_page_generic_ocr_used": False,
            },
        )

    if failed_field_count > 0:
        issues.append(_issue("OCR_PARTIAL_FAILURE"))
    if blank_father_count > 0:
        issues.append(_issue("FATHER_SECTION_BLANK"))

    upstream_review = False
    if hasattr(crop_output, "status") and getattr(crop_output, "status") == "review_required":
        upstream_review = True
        issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))
    elif hasattr(crop_output, "issues"):
        upstream_codes = {
            issue.get("code") for issue in getattr(crop_output, "issues", [])
        }
        if {
            "REGISTRATION_REVIEW_PROPAGATED",
            "REGISTRATION_BOUNDARY_INFERRED",
        } & upstream_codes:
            upstream_review = True
            issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))

    issues.append(_issue("OCR_MANUAL_REVIEW_REQUIRED"))

    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required",
        data=PSABirthRowOCROutput(
            fields=tuple(results),
            field_count=len(results),
        ),
        issues=issues,
        metrics={
            "field_count": len(results),
            "successful_field_count": successful_field_count,
            "failed_field_count": failed_field_count,
            "blank_father_count": blank_father_count,
            "total_ocr_attempts": total_ocr_attempts,
            "preprocessing_seconds": round(preprocessing_seconds, 6),
            "ocr_seconds": round(ocr_seconds, 6),
            "validation_seconds": round(validation_seconds, 6),
            "total_processing_seconds": round(
                perf_counter() - stage_started,
                6,
            ),
            "manual_review_required": True,
            "upstream_review_propagated": upstream_review,
            "full_page_generic_ocr_used": False,
            "name_cell_crop_used": True,
        },
    )
