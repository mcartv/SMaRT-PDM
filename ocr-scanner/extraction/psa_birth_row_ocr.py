from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from time import perf_counter
from types import MappingProxyType
from typing import Any, Callable, Mapping, Sequence

import cv2
import numpy as np
import pytesseract
from pytesseract import Output

from .ocr_engine import (
    OCRBinaryUnavailableError,
    OCRExecutionError,
    OCRInputError,
    ocr_image,
)
from .paddle_birth_recognizer import (
    PaddleBirthOCRUnavailable,
    recognize_birth_name_batch,
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
        "first name",
        "middle",
        "middle name",
        "last",
        "last name",
        "surname",
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
    low_confidence_threshold: float = 50.0
    paddle_confidence_threshold: float = 0.80
    paddle_model_name: str = "PP-OCRv6_medium_rec"
    paddle_batch_size: int = 3
    maximum_fallback_workers: int = 2
    ocr_timeout_seconds: float = 8.0

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
            "paddle_batch_size",
            "maximum_fallback_workers",
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
        if not 0.0 <= self.low_confidence_threshold <= 100.0:
            raise ValueError("low_confidence_threshold is invalid")
        if not 0.0 <= self.paddle_confidence_threshold <= 1.0:
            raise ValueError("paddle_confidence_threshold is invalid")
        if not self.paddle_model_name.strip():
            raise ValueError("paddle_model_name is required")
        if self.ocr_timeout_seconds <= 0.0:
            raise ValueError("ocr_timeout_seconds must be positive")
        if self.maximum_fallback_workers > 2:
            raise ValueError("maximum_fallback_workers must not exceed two")
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
    confidence: float | None = None
    component_confidence: Mapping[str, float | None] = field(
        default_factory=lambda: MappingProxyType({})
    )
    component_raw_text: Mapping[str, str] = field(
        default_factory=lambda: MappingProxyType({})
    )


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
    gray = _gray(crop)
    if int(gray.max()) - int(gray.min()) >= 8:
        gray = cv2.createCLAHE(
            clipLimit=2.0,
            tileGridSize=(8, 8),
        ).apply(gray)
    gray = cv2.medianBlur(gray, 3)
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


def preprocess_psa_watermark(
    crop: np.ndarray,
    target_height: int,
) -> tuple[np.ndarray, float]:
    """Build a Birth-only fallback that suppresses colored PSA security ink.

    The primary ``_preprocess_cell`` path is intentionally unchanged. This
    fallback preserves luminance text and uses LAB chroma only to identify
    colored watermark pixels; discarding luminance would also discard black
    typewritten names.
    """

    if crop.ndim == 2:
        bgr = cv2.cvtColor(crop, cv2.COLOR_GRAY2BGR)
    elif crop.ndim == 3 and crop.shape[2] == 4:
        bgr = cv2.cvtColor(crop, cv2.COLOR_BGRA2BGR)
    else:
        bgr = crop.copy()
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    luminance, channel_a, channel_b = cv2.split(lab)
    chroma_distance = cv2.add(
        cv2.absdiff(channel_a, np.full_like(channel_a, 128)),
        cv2.absdiff(channel_b, np.full_like(channel_b, 128)),
    )
    watermark_mask = cv2.threshold(
        chroma_distance,
        14,
        255,
        cv2.THRESH_BINARY,
    )[1]
    watermark_mask = cv2.morphologyEx(
        watermark_mask,
        cv2.MORPH_CLOSE,
        np.ones((1, 5), np.uint8),
    )
    suppressed = luminance.copy()
    suppressed[watermark_mask > 0] = 255
    background = cv2.GaussianBlur(suppressed, (0, 0), 3.0)
    normalized = cv2.divide(suppressed, background, scale=255)
    binary = cv2.adaptiveThreshold(
        normalized,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        51,
        5,
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
        for label in (
            "date of birth", "maiden name", "citizenship", "residence",
            "name of child", "name of mother", "name of father",
        )
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


@dataclass(frozen=True)
class _ComponentObservation:
    raw_text: str = ""
    candidate: str = ""
    confidence: float | None = None
    engine: str = ""


def _tesseract_data(image: np.ndarray, timeout_seconds: float) -> Mapping[str, Any]:
    kwargs = {
        "config": "--oem 3 --psm 7 -l eng",
        "output_type": Output.DICT,
    }
    try:
        return pytesseract.image_to_data(
            image,
            timeout=timeout_seconds,
            **kwargs,
        )
    except TypeError:
        return pytesseract.image_to_data(image, **kwargs)


def _valid_data_words(data: Mapping[str, Any]) -> list[dict[str, Any]]:
    keys = ("text", "conf", "left", "width")
    values = [list(data.get(key, ())) for key in keys]
    if not values or any(len(value) != len(values[0]) for value in values):
        return []
    words: list[dict[str, Any]] = []
    for text, confidence, left, width in zip(*values):
        raw = _normalize_text(text)
        try:
            numeric_confidence = float(confidence)
            numeric_left = int(left)
            numeric_width = int(width)
        except (TypeError, ValueError):
            continue
        if not raw or numeric_confidence < 0 or numeric_width <= 0:
            continue
        words.append({
            "text": raw,
            "confidence": numeric_confidence,
            "left": numeric_left,
            "width": numeric_width,
        })
    return words


def _closest_name_candidate(value: Any, config: PSABirthRowOCRConfig) -> str:
    raw = _normalize_text(value)
    if not raw:
        return ""
    tokens: list[str] = []
    substitutions = str.maketrans({"0": "O", "1": "I", "5": "S", "8": "B"})
    for source_token in raw.split():
        token = source_token.strip("\"“”()[]{}:;,!?|_=+*/\\")
        if any(character.isalpha() for character in token):
            token = token.translate(substitutions)
        if any(character.isdigit() for character in token):
            continue
        token = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿÑñ.'’\-]", "", token)
        if token:
            tokens.append(token)
    candidate = " ".join(tokens)
    if not candidate:
        return ""
    lowered = candidate.casefold()
    if lowered in _FORBIDDEN_LABELS or any(
        label in lowered
        for label in (
            "date of birth", "maiden name", "citizenship", "residence",
            "name of child", "name of mother", "name of father",
        )
    ):
        return ""
    return _validate_candidate(candidate, config)


def _weighted_confidence(words: Sequence[Mapping[str, Any]]) -> float | None:
    weighted = [
        (float(word["confidence"]), max(1, len(str(word["text"]))))
        for word in words
        if word.get("confidence") is not None
    ]
    denominator = sum(weight for _confidence, weight in weighted)
    if denominator <= 0:
        return None
    return sum(confidence * weight for confidence, weight in weighted) / denominator


def _observation_from_words(
    words: Sequence[Mapping[str, Any]],
    config: PSABirthRowOCRConfig,
) -> _ComponentObservation:
    raw_text = " ".join(str(word.get("text") or "") for word in words).strip()
    return _ComponentObservation(
        raw_text=raw_text,
        candidate=_closest_name_candidate(raw_text, config),
        confidence=_weighted_confidence(words),
        engine="tesseract",
    )


def _paddle_observation(
    value: tuple[str, float | None],
    config: PSABirthRowOCRConfig,
) -> _ComponentObservation:
    raw_text, unit_confidence = value
    confidence = (
        float(unit_confidence) * 100.0
        if unit_confidence is not None
        else None
    )
    return _ComponentObservation(
        raw_text=_normalize_text(raw_text),
        candidate=_closest_name_candidate(raw_text, config),
        confidence=confidence,
        engine="paddleocr",
    )


def _vote_key(value: str) -> str:
    return "".join(character.casefold() for character in value if character.isalnum())


def _vote_observations(
    paddle: _ComponentObservation,
    tesseract: _ComponentObservation,
    config: PSABirthRowOCRConfig,
) -> _ComponentObservation:
    if paddle.candidate and tesseract.candidate:
        if _vote_key(paddle.candidate) == _vote_key(tesseract.candidate):
            paddle_confidence = paddle.confidence or 0.0
            tesseract_confidence = tesseract.confidence or 0.0
            preferred = paddle if paddle_confidence >= tesseract_confidence else tesseract
            return _ComponentObservation(
                raw_text=preferred.raw_text,
                candidate=preferred.candidate,
                confidence=max(paddle_confidence, tesseract_confidence),
                engine="paddleocr+tesseract_agreement",
            )
        if (
            paddle.confidence is None
            or paddle.confidence < config.paddle_confidence_threshold * 100.0
        ):
            return tesseract
        paddle_confidence = paddle.confidence or -1.0
        tesseract_confidence = tesseract.confidence or -1.0
        return paddle if paddle_confidence >= tesseract_confidence else tesseract
    if paddle.candidate:
        return paddle
    return tesseract


def _paddle_cell_observations(
    keys: Sequence[str],
    images: Sequence[np.ndarray],
    config: PSABirthRowOCRConfig,
) -> dict[str, _ComponentObservation]:
    recognized = recognize_birth_name_batch(
        images,
        model_name=config.paddle_model_name,
        batch_size=config.paddle_batch_size,
    )
    return {
        key: _paddle_observation(
            recognized[index] if index < len(recognized) else ("", None),
            config,
        )
        for index, key in enumerate(keys)
    }


def _tesseract_row_observations(
    rows: Mapping[str, tuple[np.ndarray, Sequence[float]]],
    config: PSABirthRowOCRConfig,
) -> tuple[
    dict[str, dict[str, _ComponentObservation]],
    set[str],
]:
    observations: dict[str, dict[str, _ComponentObservation]] = {}
    failed: set[str] = set()
    for field_name in FIELD_NAMES:
        processed, boundaries = rows[field_name]
        try:
            observations[field_name] = _row_observations(
                processed,
                boundaries,
                config,
            )
        except Exception:
            failed.add(field_name)
            observations[field_name] = {
                name: _ComponentObservation(engine="tesseract")
                for name in COMPONENT_NAMES
            }
    return observations, failed


def _row_observations(
    processed: np.ndarray,
    boundaries: Sequence[float],
    config: PSABirthRowOCRConfig,
) -> dict[str, _ComponentObservation]:
    words = _valid_data_words(_tesseract_data(processed, config.ocr_timeout_seconds))
    inner_left = 18
    inner_width = max(1, processed.shape[1] - 36)
    grouped: dict[str, list[Mapping[str, Any]]] = {
        name: [] for name in COMPONENT_NAMES
    }
    for word in words:
        center = float(word["left"]) + float(word["width"]) / 2.0
        normalized = (center - inner_left) / float(inner_width)
        if normalized < boundaries[1]:
            component = "first_name"
        elif normalized < boundaries[2]:
            component = "middle_name"
        else:
            component = "last_name"
        grouped[component].append(word)
    return {
        name: _observation_from_words(grouped[name], config)
        for name in COMPONENT_NAMES
    }


def _cell_observation(
    crop: np.ndarray,
    config: PSABirthRowOCRConfig,
) -> tuple[_ComponentObservation, int]:
    processed, _ink_ratio = _preprocess_cell(crop.copy(), config.target_height)
    words = _valid_data_words(_tesseract_data(processed, config.ocr_timeout_seconds))
    primary = _observation_from_words(words, config)
    if (
        primary.candidate
        and primary.confidence is not None
        and primary.confidence >= config.low_confidence_threshold
    ):
        return primary, 1
    watermark_processed, _watermark_ink_ratio = preprocess_psa_watermark(
        crop.copy(),
        config.target_height,
    )
    watermark_words = _valid_data_words(
        _tesseract_data(watermark_processed, config.ocr_timeout_seconds)
    )
    watermark = _observation_from_words(watermark_words, config)
    return _prefer_observation(primary, watermark), 2


def _prefer_observation(
    primary: _ComponentObservation,
    fallback: _ComponentObservation,
) -> _ComponentObservation:
    if not primary.candidate:
        return fallback if fallback.candidate else primary
    if not fallback.candidate:
        return primary
    primary_confidence = primary.confidence if primary.confidence is not None else -1.0
    fallback_confidence = fallback.confidence if fallback.confidence is not None else -1.0
    return fallback if fallback_confidence > primary_confidence else primary


def _empty_components() -> Mapping[str, str]:
    return MappingProxyType({name: "" for name in COMPONENT_NAMES})


def _extract_with_ensemble(
    output: PSABirthRowCropperOutput,
    resolved: PSABirthRowOCRConfig,
    *,
    started: float,
    upstream_review: bool,
) -> StageResult[PSABirthRowOCROutput]:
    if set(output.row_crops) != set(FIELD_NAMES) or set(output.topology) != set(FIELD_NAMES):
        return _failure("BIRTH_NAME_TOPOLOGY_REQUIRED")

    expected_keys = {
        f"{field_name}.{component_name}"
        for field_name in FIELD_NAMES
        for component_name in COMPONENT_NAMES
    }
    if set(output.crops) != expected_keys:
        return _failure("REQUIRED_NAME_CELL_CROP_MISSING")

    attempts = 0
    preprocessing_seconds = 0.0
    ocr_seconds = 0.0
    processed_rows: dict[str, tuple[np.ndarray, Sequence[float]]] = {}
    for field_name in FIELD_NAMES:
        row_crop = _valid_crop(output.row_crops.get(field_name))
        topology = output.topology.get(field_name)
        if row_crop is None or topology is None:
            return _failure("BIRTH_NAME_TOPOLOGY_REQUIRED")
        preprocess_started = perf_counter()
        processed, _ink_ratio = _preprocess_cell(row_crop.copy(), resolved.target_height)
        preprocessing_seconds += perf_counter() - preprocess_started
        processed_rows[field_name] = (
            processed,
            topology.relative_component_boundaries,
        )

    paddle_keys: list[str] = []
    paddle_images: list[np.ndarray] = []
    for key in sorted(expected_keys):
        crop = _valid_crop(output.crops.get(key))
        if crop is None:
            return _failure("ROW_CROP_INVALID")
        preprocess_started = perf_counter()
        processed, _ink_ratio = _preprocess_cell(crop.copy(), resolved.target_height)
        preprocessing_seconds += perf_counter() - preprocess_started
        paddle_keys.append(key)
        paddle_images.append(processed)

    paddle_observations: dict[str, _ComponentObservation] = {}
    paddle_available = True
    ocr_started = perf_counter()
    with ThreadPoolExecutor(max_workers=2) as engine_executor:
        tesseract_future = engine_executor.submit(
            _tesseract_row_observations,
            processed_rows,
            resolved,
        )
        paddle_future = engine_executor.submit(
            _paddle_cell_observations,
            paddle_keys,
            paddle_images,
            resolved,
        )
        observations, execution_failed_fields = tesseract_future.result()
        try:
            paddle_observations = paddle_future.result()
        except PaddleBirthOCRUnavailable:
            paddle_available = False
    ocr_seconds += perf_counter() - ocr_started
    attempts += 3 + (len(paddle_keys) if paddle_available else 0)

    selected_engine_counts: dict[str, int] = {}
    for key in paddle_keys:
        field_name, component_name = key.split(".", 1)
        selected = _vote_observations(
            paddle_observations.get(key, _ComponentObservation(engine="paddleocr")),
            observations[field_name][component_name],
            resolved,
        )
        observations[field_name][component_name] = selected
        selected_engine_counts[selected.engine or "none"] = (
            selected_engine_counts.get(selected.engine or "none", 0) + 1
        )

    fallback_keys = [
        f"{field_name}.{component_name}"
        for field_name in FIELD_NAMES
        for component_name in COMPONENT_NAMES
        if (
            not observations[field_name][component_name].candidate
            or observations[field_name][component_name].confidence is None
            or observations[field_name][component_name].confidence
            < resolved.low_confidence_threshold
        )
    ]
    fallback_results: dict[str, _ComponentObservation] = {}
    fallback_attempt_counts: dict[str, int] = {}
    fallback_started = perf_counter()
    if fallback_keys:
        with ThreadPoolExecutor(
            max_workers=min(resolved.maximum_fallback_workers, len(fallback_keys))
        ) as executor:
            futures = {
                executor.submit(
                    _cell_observation,
                    np.array(output.crops[key], copy=True),
                    resolved,
                ): key
                for key in fallback_keys
                if _valid_crop(output.crops.get(key)) is not None
            }
            attempts += len(futures)
            for future in as_completed(futures):
                key = futures[future]
                try:
                    observation, attempt_count = future.result()
                    fallback_results[key] = observation
                    fallback_attempt_counts[key] = attempt_count
                except Exception:
                    fallback_results[key] = _ComponentObservation()
                    fallback_attempt_counts[key] = 1
    attempts += sum(fallback_attempt_counts.values()) - len(fallback_results)
    ocr_seconds += perf_counter() - fallback_started

    for key, fallback in fallback_results.items():
        field_name, component_name = key.split(".", 1)
        observations[field_name][component_name] = _prefer_observation(
            observations[field_name][component_name],
            fallback,
        )

    results: list[PSABirthRowOCRFieldResult] = []
    successful = 0
    controlled_blank_father = 0
    low_confidence_fields = 0
    for field_name in FIELD_NAMES:
        row = observations[field_name]
        components = {
            name: row[name].candidate for name in COMPONENT_NAMES
        }
        raw_components = {
            name: row[name].raw_text for name in COMPONENT_NAMES
        }
        component_confidence = {
            name: row[name].confidence for name in COMPONENT_NAMES
        }
        relevant_confidences = [
            confidence
            for name, confidence in component_confidence.items()
            if components[name] and confidence is not None
        ]
        confidence = (
            sum(relevant_confidences) / len(relevant_confidences)
            if relevant_confidences
            else None
        )
        codes: set[str] = set()
        any_not_applicable = field_name == "father_name" and any(
            _normalize_not_applicable_candidate(value) == "N/A"
            for value in raw_components.values()
        )
        any_text = any(components.values())
        required_present = bool(components["first_name"]) and bool(
            components["last_name"]
        )
        if field_name in execution_failed_fields and not any_text:
            success = False
            section_status = "incomplete"
            assembled = ""
            codes.add("OCR_EXECUTION_FAILED")
        elif field_name == "father_name" and any_not_applicable and not any_text:
            success = True
            section_status = "not_applicable"
            assembled = "N/A"
            codes.add("father_name_not_applicable")
        elif field_name == "father_name" and not any(
            raw_components.values()
        ):
            success = True
            section_status = "blank"
            assembled = ""
            controlled_blank_father += 1
            codes.add("father_section_blank")
        else:
            assembled = " ".join(
                components[name] for name in COMPONENT_NAMES if components[name]
            )
            success = required_present
            section_status = "present" if success else "incomplete"
            if not success:
                codes.add(
                    "father_name_incomplete"
                    if field_name == "father_name"
                    else f"{field_name}_not_found"
                )
        if any(
            components[name]
            and (
                component_confidence[name] is None
                or component_confidence[name] < resolved.low_confidence_threshold
            )
            for name in COMPONENT_NAMES
        ):
            codes.add("birth_name_low_confidence")
            low_confidence_fields += 1
        if success:
            successful += 1
        results.append(
            PSABirthRowOCRFieldResult(
                name=field_name,
                raw_text=assembled,
                components=MappingProxyType(dict(components)),
                section_status=section_status,
                review_required=True,
                success=success,
                issue_codes=tuple(sorted(codes)),
                preprocessing_variant=resolved.preprocessing_variant,
                ocr_attempts=(
                    1 + sum(
                        1 for component_name in COMPONENT_NAMES
                        if f"{field_name}.{component_name}" in fallback_results
                    )
                ),
                confidence=confidence,
                component_confidence=MappingProxyType(dict(component_confidence)),
                component_raw_text=MappingProxyType(dict(raw_components)),
            )
        )

    result_data = PSABirthRowOCROutput(fields=tuple(results), field_count=3)
    metrics = {
        "field_count": 3,
        "cell_count": 9,
        "successful_field_count": successful,
        "failed_field_count": 3 - successful,
        "controlled_blank_father_count": controlled_blank_father,
        "low_confidence_field_count": low_confidence_fields,
        "row_ocr_attempts": 3,
        "fallback_cell_ocr_attempts": len(fallback_results),
        "watermark_fallback_ocr_attempts": sum(
            max(0, count - 1) for count in fallback_attempt_counts.values()
        ),
        "total_ocr_attempts": attempts,
        "preprocessing_seconds": round(preprocessing_seconds, 6),
        "ocr_seconds": round(ocr_seconds, 6),
        "total_processing_seconds": round(perf_counter() - started, 6),
        "manual_review_required": True,
        "name_cell_crop_used": bool(fallback_results),
        "full_row_crop_used": True,
        "full_page_generic_ocr_used": False,
        "confidence_source": (
            "paddleocr_tesseract_vote"
            if paddle_available
            else "tesseract_image_to_data"
        ),
        "paddle_model_name": resolved.paddle_model_name,
        "paddle_confidence_threshold": resolved.paddle_confidence_threshold,
        "paddle_available": paddle_available,
        "ensemble_parallel": True,
        "selected_engine_counts": dict(selected_engine_counts),
    }
    if successful == 0:
        return _failure("OCR_ALL_FIELDS_FAILED", data=result_data, **metrics)
    issues: list[dict[str, str]] = []
    if successful < 3:
        issues.append(_issue("OCR_PARTIAL_FAILURE"))
    if low_confidence_fields:
        issues.append(_issue("BIRTH_NAME_LOW_CONFIDENCE"))
    if controlled_blank_father:
        issues.append(_issue("father_section_blank", "father_name"))
    if upstream_review:
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
    if ocr_reader is None:
        return _extract_with_ensemble(
            output,
            resolved,
            started=started,
            upstream_review=(
                getattr(crop_output, "status", "") == "review_required"
            ),
        )
    reader = ocr_reader

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
