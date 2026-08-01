from __future__ import annotations

import re
from dataclasses import dataclass
from time import perf_counter
from types import MappingProxyType
from typing import Any, Callable, Mapping, Sequence

import cv2
import numpy as np

from .ocr_engine import (
    OCRBinaryUnavailableError,
    OCRExecutionError,
    OCRInputError,
    ocr_image,
)
from .psa_birth_row_cropper import (
    COMPONENT_NAMES,
    FIELD_NAMES,
    PSABirthRowCropperOutput,
)
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_ocr"
REQUIRED_FIELDS = FIELD_NAMES
PREPROCESSING_VARIANT = "registered_independent_name_cell_ocr"

_SPACE_PATTERN = re.compile(r"\s+")
_ALLOWED_NAME_PATTERN = re.compile(
    r"^[A-Za-zÀ-ÖØ-öø-ÿÑñ]+"
    r"(?:[.'’\-][A-Za-zÀ-ÖØ-öø-ÿÑñ]+)*\.?"
    r"(?:\s+[A-Za-zÀ-ÖØ-öø-ÿÑñ]+"
    r"(?:[.'’\-][A-Za-zÀ-ÖØ-öø-ÿÑñ]+)*\.?)*$"
)
_FORBIDDEN_LABELS = frozenset(
    {
        "name",
        "maiden name",
        "first",
        "middle",
        "last",
        "sex",
        "date of birth",
        "citizenship",
        "occupation",
        "residence",
        "address",
    }
)


@dataclass(frozen=True)
class PSABirthRowOCRConfig:
    required_fields: tuple[str, ...] = REQUIRED_FIELDS
    preprocessing_variant: str = PREPROCESSING_VARIANT
    minimum_alpha_characters: int = 1
    maximum_name_tokens_per_cell: int = 4
    maximum_name_characters_per_cell: int = 50
    target_height: int = 140
    blank_ink_ratio_threshold: float = 0.003

    def __post_init__(self) -> None:
        if tuple(self.required_fields) != REQUIRED_FIELDS:
            raise ValueError("required fields must remain in approved order")
        if self.preprocessing_variant not in {
            PREPROCESSING_VARIANT,
            "registered_name_cell_ocr",
            "registered_whole_row_ocr",
        }:
            raise ValueError("unsupported birth OCR preprocessing variant")
        for name in (
            "minimum_alpha_characters",
            "maximum_name_tokens_per_cell",
            "maximum_name_characters_per_cell",
            "target_height",
        ):
            value = getattr(self, name)
            if (
                isinstance(value, bool)
                or not isinstance(value, int)
                or value <= 0
            ):
                raise ValueError(f"{name} must be a positive integer")
        if not 0.0 <= self.blank_ink_ratio_threshold <= 0.1:
            raise ValueError("blank ink ratio threshold is invalid")
        object.__setattr__(self, "preprocessing_variant", PREPROCESSING_VARIANT)


@dataclass(frozen=True)
class PSABirthRowOCRFieldResult:
    name: str
    raw_text: str
    components: Mapping[str, str]
    section_status: str
    review_required: bool
    success: bool
    issue_codes: tuple[str, ...]
    preprocessing_variant: str
    ocr_attempts: int


@dataclass(frozen=True)
class PSABirthRowOCROutput:
    fields: tuple[PSABirthRowOCRFieldResult, ...]
    field_count: int


def _issue(code: str, field_name: str = "") -> dict[str, str]:
    return {"code": code, "stage": STAGE_NAME, "field": field_name}


def _failure(
    code: str,
    *,
    data: PSABirthRowOCROutput | None = None,
    **metrics: Any,
) -> StageResult[PSABirthRowOCROutput]:
    return StageResult(
        stage=STAGE_NAME,
        success=False,
        status="failed",
        data=data,
        issues=[_issue(code)],
        metrics=dict(metrics),
    )


def _resolve_config(
    config: PSABirthRowOCRConfig | Mapping[str, Any] | None,
) -> PSABirthRowOCRConfig:
    if config is None:
        return PSABirthRowOCRConfig()
    if isinstance(config, PSABirthRowOCRConfig):
        return PSABirthRowOCRConfig(**vars(config))
    if not isinstance(config, Mapping):
        raise ValueError("config must be an OCR config or mapping")
    allowed = set(PSABirthRowOCRConfig.__dataclass_fields__)
    unknown = set(config) - allowed
    if unknown:
        raise ValueError(f"unsupported configuration keys: {sorted(unknown)}")
    values = dict(config)
    if "required_fields" in values:
        values["required_fields"] = tuple(values["required_fields"])
    return PSABirthRowOCRConfig(**values)


def _resolve_crop_output(value: Any) -> PSABirthRowCropperOutput | None:
    if isinstance(value, PSABirthRowCropperOutput):
        return value
    data = getattr(value, "data", None)
    return data if isinstance(data, PSABirthRowCropperOutput) else None


def _valid_crop(value: Any) -> np.ndarray | None:
    if not isinstance(value, np.ndarray) or value.dtype != np.uint8:
        return None
    if value.ndim == 2:
        image = value
    elif value.ndim == 3 and value.shape[2] in (3, 4):
        image = value
    else:
        return None
    if image.size == 0 or image.shape[0] <= 0 or image.shape[1] <= 0:
        return None
    return np.ascontiguousarray(image)


def _gray(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image.copy()
    code = cv2.COLOR_BGRA2GRAY if image.shape[2] == 4 else cv2.COLOR_BGR2GRAY
    return cv2.cvtColor(image, code)


def _remove_grid_lines(binary: np.ndarray) -> np.ndarray:
    inverted = cv2.bitwise_not(binary)
    height, width = inverted.shape
    horizontal = cv2.morphologyEx(
        inverted,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (max(20, width // 5), 1),
        ),
    )
    vertical = cv2.morphologyEx(
        inverted,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (1, max(12, height // 2)),
        ),
    )
    return cv2.bitwise_not(
        cv2.subtract(inverted, cv2.bitwise_or(horizontal, vertical))
    )


def _preprocess_cell(
    crop: np.ndarray,
    target_height: int,
) -> tuple[np.ndarray, float]:
    gray = cv2.GaussianBlur(_gray(crop), (3, 3), 0)
    if int(gray.max()) - int(gray.min()) >= 8:
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    _, binary = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    cleaned = _remove_grid_lines(binary)
    ink_ratio = np.count_nonzero(cleaned < 180) / float(cleaned.size or 1)
    height, width = cleaned.shape
    scale = max(3.0, target_height / float(max(height, 1)))
    resized = cv2.resize(
        cleaned,
        (
            max(1, int(round(width * scale))),
            max(target_height, int(round(height * scale))),
        ),
        interpolation=cv2.INTER_CUBIC,
    )
    bordered = cv2.copyMakeBorder(
        resized,
        14,
        14,
        18,
        18,
        cv2.BORDER_CONSTANT,
        value=255,
    )
    return np.ascontiguousarray(bordered), float(ink_ratio)


def _normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    return _SPACE_PATTERN.sub(
        " ",
        text.replace("\r", " ").replace("\n", " ").replace("`", "'"),
    ).strip()


def _normalize_not_applicable_candidate(value: Any) -> str | None:
    compact = re.sub(
        r"[\s./_\-]+",
        "",
        _normalize_text(value),
    ).upper()
    return "N/A" if compact == "NA" else None


def _validate_candidate(
    value: Any,
    config: PSABirthRowOCRConfig,
) -> str:
    candidate = _normalize_text(value)
    if not candidate:
        return ""
    if len(candidate) > config.maximum_name_characters_per_cell:
        return ""
    if len(candidate.split()) > config.maximum_name_tokens_per_cell:
        return ""
    if sum(character.isalpha() for character in candidate) < config.minimum_alpha_characters:
        return ""
    if any(character.isdigit() for character in candidate):
        return ""
    if candidate.casefold() in _FORBIDDEN_LABELS:
        return ""
    if any(
        label in candidate.casefold()
        for label in ("date of birth", "maiden name", "citizenship", "residence")
    ):
        return ""
    return candidate if _ALLOWED_NAME_PATTERN.fullmatch(candidate) else ""


def _select_candidate(
    value: Any,
    config: PSABirthRowOCRConfig,
) -> tuple[str, bool]:
    if isinstance(value, Sequence) and not isinstance(
        value,
        (str, bytes, bytearray),
    ):
        valid = {
            candidate
            for candidate in (
                _validate_candidate(item, config) for item in value
            )
            if candidate
        }
        if len(valid) > 1:
            return "", True
        return (next(iter(valid)), False) if valid else ("", False)
    return _validate_candidate(value, config), False


def _default_reader(image: np.ndarray) -> str:
    return ocr_image(
        image,
        config={
            "page_segmentation_mode": 7,
            "strip_outer_whitespace": True,
        },
    )


def _empty_components() -> Mapping[str, str]:
    return MappingProxyType({name: "" for name in COMPONENT_NAMES})


def extract_psa_birth_row_text(
    crop_output: Any,
    ocr_reader: Callable[[np.ndarray], Any] | None = None,
    config: PSABirthRowOCRConfig | Mapping[str, Any] | None = None,
) -> StageResult[PSABirthRowOCROutput]:
    started = perf_counter()
    try:
        resolved = _resolve_config(config)
    except (TypeError, ValueError):
        return _failure("ROW_CROP_INVALID")
    output = _resolve_crop_output(crop_output)
    if output is None:
        return _failure("ROW_CROP_OUTPUT_INVALID")
    if ocr_reader is not None and not callable(ocr_reader):
        return _failure("OCR_READER_INVALID")
    reader = ocr_reader or _default_reader

    expected_keys = {
        f"{field}.{component}"
        for field in FIELD_NAMES
        for component in COMPONENT_NAMES
    }
    if set(output.crops) != expected_keys:
        return _failure("REQUIRED_NAME_CELL_CROP_MISSING")
    if {region.name for region in output.regions} != expected_keys:
        return _failure("REQUIRED_NAME_CELL_CROP_MISSING")

    component_values: dict[str, dict[str, str]] = {
        field: {} for field in FIELD_NAMES
    }
    component_blank: dict[str, dict[str, bool]] = {
        field: {} for field in FIELD_NAMES
    }
    component_not_applicable: dict[str, dict[str, bool]] = {
        field: {} for field in FIELD_NAMES
    }
    component_observations: dict[str, dict[str, str]] = {
        field: {} for field in FIELD_NAMES
    }
    component_failures: dict[str, set[str]] = {
        field: set() for field in FIELD_NAMES
    }
    attempts = 0
    preprocessing_seconds = 0.0
    ocr_seconds = 0.0

    for field_name in FIELD_NAMES:
        for component_name in COMPONENT_NAMES:
            key = f"{field_name}.{component_name}"
            crop = _valid_crop(output.crops.get(key))
            if crop is None:
                return _failure("ROW_CROP_INVALID")
            preprocess_started = perf_counter()
            processed, ink_ratio = _preprocess_cell(
                crop.copy(),
                resolved.target_height,
            )
            preprocessing_seconds += perf_counter() - preprocess_started
            attempts += 1
            ocr_started = perf_counter()
            try:
                source = reader(processed.copy())
            except (
                OCRInputError,
                OCRBinaryUnavailableError,
                OCRExecutionError,
                Exception,
            ):
                ocr_seconds += perf_counter() - ocr_started
                component_values[field_name][component_name] = ""
                component_blank[field_name][component_name] = False
                component_not_applicable[field_name][component_name] = False
                component_observations[field_name][component_name] = ""
                component_failures[field_name].add("OCR_EXECUTION_FAILED")
                continue
            ocr_seconds += perf_counter() - ocr_started
            observation = _normalize_text(source)
            not_applicable = (
                field_name == "father_name"
                and _normalize_not_applicable_candidate(observation) == "N/A"
            )
            component_observations[field_name][component_name] = observation
            component_not_applicable[field_name][component_name] = (
                not_applicable
            )
            if not_applicable:
                component_values[field_name][component_name] = ""
                component_blank[field_name][component_name] = False
                continue
            candidate, conflict = _select_candidate(source, resolved)
            component_values[field_name][component_name] = candidate
            component_blank[field_name][component_name] = (
                not candidate
                and not _normalize_text(source)
                and ink_ratio <= resolved.blank_ink_ratio_threshold
            )
            if conflict:
                component_failures[field_name].add(
                    "birth_name_source_conflict"
                )
            elif not candidate and not component_blank[field_name][component_name]:
                component_failures[field_name].add(
                    "positional_validation_failed"
                )

    results: list[PSABirthRowOCRFieldResult] = []
    successful = 0
    controlled_blank_father = 0
    for field_name in FIELD_NAMES:
        values = component_values[field_name]
        blank = component_blank[field_name]
        not_applicable = component_not_applicable[field_name]
        observations = component_observations[field_name]
        codes = set(component_failures[field_name])
        all_blank = all(blank.get(name, False) for name in COMPONENT_NAMES)
        any_not_applicable = any(
            not_applicable.get(name, False) for name in COMPONENT_NAMES
        )
        not_applicable_conflict = any_not_applicable and any(
            (
                values.get(name, "")
                or observations.get(name, "")
                or not blank.get(name, False)
            )
            for name in COMPONENT_NAMES
            if not not_applicable.get(name, False)
        )
        required_present = bool(values.get("first_name")) and bool(
            values.get("last_name")
        )

        section_status = "present"
        compatibility_raw_text: str | None = None
        if field_name == "father_name" and not_applicable_conflict:
            success = False
            section_status = "incomplete"
            codes.add("father_name_not_applicable_conflict")
        elif field_name == "father_name" and any_not_applicable:
            success = True
            section_status = "not_applicable"
            compatibility_raw_text = "N/A"
            codes.add("father_name_not_applicable")
        elif field_name == "father_name" and all_blank:
            success = True
            section_status = "blank"
            controlled_blank_father += 1
            codes.add("father_section_blank")
        elif field_name == "father_name" and not required_present:
            success = False
            section_status = "incomplete"
            codes.add("father_name_incomplete")
        elif field_name != "father_name" and not required_present:
            success = False
            section_status = "incomplete"
            codes.add(f"{field_name}_not_found")
        else:
            success = not bool(
                {"birth_name_source_conflict", "OCR_EXECUTION_FAILED"} & codes
            )

        if success:
            successful += 1
        assembled = " ".join(
            values.get(component, "")
            for component in COMPONENT_NAMES
            if values.get(component, "")
        )
        if compatibility_raw_text is not None:
            assembled = compatibility_raw_text
        results.append(
            PSABirthRowOCRFieldResult(
                name=field_name,
                raw_text=assembled,
                components=MappingProxyType(
                    {
                        component: values.get(component, "")
                        for component in COMPONENT_NAMES
                    }
                ),
                section_status=section_status,
                review_required=True,
                success=success,
                issue_codes=tuple(sorted(codes)),
                preprocessing_variant=resolved.preprocessing_variant,
                ocr_attempts=3,
            )
        )

    result_data = PSABirthRowOCROutput(
        fields=tuple(results),
        field_count=len(results),
    )
    metrics = {
        "field_count": len(results),
        "cell_count": 9,
        "successful_field_count": successful,
        "failed_field_count": len(results) - successful,
        "controlled_blank_father_count": controlled_blank_father,
        "total_ocr_attempts": attempts,
        "preprocessing_seconds": round(preprocessing_seconds, 6),
        "ocr_seconds": round(ocr_seconds, 6),
        "total_processing_seconds": round(perf_counter() - started, 6),
        "manual_review_required": True,
        "name_cell_crop_used": True,
        "full_page_generic_ocr_used": False,
    }
    if successful == 0:
        return _failure(
            "OCR_ALL_FIELDS_FAILED",
            data=result_data,
            **metrics,
        )

    issues: list[dict[str, str]] = []
    if successful < len(results):
        issues.append(_issue("OCR_PARTIAL_FAILURE"))
    if controlled_blank_father:
        issues.append(_issue("father_section_blank", "father_name"))
    if getattr(crop_output, "status", "") == "review_required":
        issues.append(_issue("REGISTRATION_REVIEW_PROPAGATED"))
    issues.append(_issue("OCR_MANUAL_REVIEW_REQUIRED"))
    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required",
        data=result_data,
        issues=issues,
        metrics=metrics,
    )
