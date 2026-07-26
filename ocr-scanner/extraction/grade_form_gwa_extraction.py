from __future__ import annotations

import re
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Mapping, Sequence

import cv2
import numpy as np
import pytesseract

from .stage_result import StageResult


STAGE_NAME = "grade_form_gwa_extraction"
FIELD_NAME = "general_weighted_average"
LABELS = (
    ("Cumulative GWA", ("cumulative", "gwa")),
    ("General Weighted Average", ("general", "weighted", "average")),
    ("General Average", ("general", "average")),
    ("Weighted Average", ("weighted", "average")),
    ("GWA", ("gwa",)),
)


@dataclass(frozen=True)
class GradeFormGWAConfig:
    language: str = "eng"
    oem: int = 3
    page_segmentation_mode: int = 11
    crop_page_segmentation_mode: int = 7
    maximum_dimension: int = 1600
    minimum_word_confidence: float = 15.0
    positional_timeout_seconds: float = 8.0
    crop_timeout_seconds: float = 5.0
    total_timeout_seconds: float = 15.0
    crop_upscale_factor: int = 4
    value_region_width_ratio: float = 0.28
    value_region_vertical_padding: float = 0.75


@dataclass(frozen=True)
class PositionalWord:
    text: str
    normalized: str
    confidence: float
    left: int
    top: int
    width: int
    height: int
    block: int
    paragraph: int
    line: int
    order: int

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def bottom(self) -> int:
        return self.top + self.height

    @property
    def center_y(self) -> float:
        return self.top + (self.height / 2.0)


@dataclass(frozen=True)
class GradeFormGWAFieldResult:
    field_name: str
    raw_text: str
    normalized_value: str | None
    success: bool
    review_required: bool
    issue_codes: tuple[str, ...]
    value_source: str
    normalization_applied: bool
    normalization_type: str
    decimal_evidence_detected: bool
    label_type: str
    normalized_bounds: tuple[float, float, float, float] | None


@dataclass(frozen=True)
class GradeFormGWAOutput:
    field: GradeFormGWAFieldResult
    raw_text: str
    detection_variant: str


@dataclass(frozen=True)
class _LabelMatch:
    label_type: str
    label_words: tuple[PositionalWord, ...]
    visual_line: tuple[PositionalWord, ...]


WordReader = Callable[
    [np.ndarray, GradeFormGWAConfig],
    Mapping[str, Sequence[Any]],
]
ValueReader = Callable[[np.ndarray, str, GradeFormGWAConfig, float], Any]


def _issue(code: str) -> dict[str, str]:
    return {"code": code, "stage": STAGE_NAME, "field": FIELD_NAME}


def _normalize_token(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _normalize_text(value: Any) -> str:
    return re.sub(
        r"\s+",
        " ",
        str(value or "").replace("\r", " ").replace("\n", " "),
    ).strip()


def _resolve_config(
    config: GradeFormGWAConfig | Mapping[str, Any] | None,
) -> GradeFormGWAConfig:
    if config is None:
        resolved = GradeFormGWAConfig()
    elif isinstance(config, GradeFormGWAConfig):
        resolved = GradeFormGWAConfig(**vars(config))
    elif isinstance(config, Mapping):
        allowed = set(GradeFormGWAConfig.__dataclass_fields__)
        unknown = set(config) - allowed
        if unknown:
            raise ValueError("unsupported Grade Form GWA configuration")
        resolved = GradeFormGWAConfig(**dict(config))
    else:
        raise ValueError("invalid Grade Form GWA configuration")

    integer_values = (
        resolved.oem,
        resolved.page_segmentation_mode,
        resolved.crop_page_segmentation_mode,
        resolved.maximum_dimension,
        resolved.crop_upscale_factor,
    )
    if any(isinstance(value, bool) or int(value) <= 0 for value in integer_values):
        raise ValueError("integer configuration values must be positive")
    if not resolved.language:
        raise ValueError("language must be non-empty")
    if resolved.minimum_word_confidence < 0.0:
        raise ValueError("minimum confidence must be non-negative")
    if min(
        resolved.positional_timeout_seconds,
        resolved.crop_timeout_seconds,
        resolved.total_timeout_seconds,
    ) <= 0.0:
        raise ValueError("timeouts must be positive")
    if resolved.total_timeout_seconds > 15.0:
        raise ValueError("total timeout must not exceed 15 seconds")
    if not 0.0 < resolved.value_region_width_ratio <= 0.5:
        raise ValueError("value region width ratio is invalid")
    if not 0.0 <= resolved.value_region_vertical_padding <= 2.0:
        raise ValueError("value region padding is invalid")
    return resolved


def _prepare_image(image: Any, maximum_dimension: int) -> np.ndarray:
    if not isinstance(image, np.ndarray) or image.dtype != np.uint8:
        raise ValueError("image must be a uint8 numpy array")
    if image.size == 0 or image.ndim not in (2, 3):
        raise ValueError("image must be non-empty")
    if image.ndim == 3 and image.shape[2] not in (3, 4):
        raise ValueError("image channel count is invalid")

    working = np.ascontiguousarray(image.copy())
    height, width = working.shape[:2]
    longest = max(height, width)
    if longest > maximum_dimension:
        scale = maximum_dimension / float(longest)
        working = cv2.resize(
            working,
            (
                max(1, int(round(width * scale))),
                max(1, int(round(height * scale))),
            ),
            interpolation=cv2.INTER_AREA,
        )
    if working.ndim == 3:
        code = (
            cv2.COLOR_BGR2GRAY
            if working.shape[2] == 3
            else cv2.COLOR_BGRA2GRAY
        )
        working = cv2.cvtColor(working, code)
    return working


def _default_word_reader(
    image: np.ndarray,
    config: GradeFormGWAConfig,
) -> Mapping[str, Sequence[Any]]:
    return pytesseract.image_to_data(
        image,
        lang=config.language,
        config=f"--oem {config.oem} --psm {config.page_segmentation_mode}",
        output_type=pytesseract.Output.DICT,
        timeout=config.positional_timeout_seconds,
    )


def _default_value_reader(
    image: np.ndarray,
    _variant: str,
    config: GradeFormGWAConfig,
    timeout_seconds: float,
) -> str:
    return pytesseract.image_to_string(
        image,
        lang=config.language,
        config=(
            f"--oem {config.oem} "
            f"--psm {config.crop_page_segmentation_mode} "
            "-c tessedit_char_whitelist=0123456789."
        ),
        timeout=timeout_seconds,
    )


def _parse_words(
    data: Mapping[str, Sequence[Any]],
    minimum_confidence: float,
) -> tuple[PositionalWord, ...]:
    required = (
        "text",
        "conf",
        "left",
        "top",
        "width",
        "height",
        "block_num",
        "par_num",
        "line_num",
    )
    if not isinstance(data, Mapping) or any(key not in data for key in required):
        raise ValueError("positional OCR data is incomplete")
    size = len(data["text"])
    if any(len(data[key]) != size for key in required):
        raise ValueError("positional OCR columns differ in length")

    words: list[PositionalWord] = []
    for index in range(size):
        text = str(data["text"][index] or "").strip()
        normalized = _normalize_token(text)
        try:
            confidence = float(data["conf"][index])
            left = int(data["left"][index])
            top = int(data["top"][index])
            width = int(data["width"][index])
            height = int(data["height"][index])
            block = int(data["block_num"][index])
            paragraph = int(data["par_num"][index])
            line = int(data["line_num"][index])
        except (TypeError, ValueError) as exc:
            raise ValueError("positional OCR geometry is invalid") from exc
        if not normalized or confidence < minimum_confidence:
            continue
        if min(left, top, width, height) < 0 or width <= 0 or height <= 0:
            continue
        words.append(
            PositionalWord(
                text=text,
                normalized=normalized,
                confidence=confidence,
                left=left,
                top=top,
                width=width,
                height=height,
                block=block,
                paragraph=paragraph,
                line=line,
                order=index,
            )
        )
    return tuple(sorted(words, key=lambda word: (word.top, word.left, word.order)))


def _visual_lines(
    words: Sequence[PositionalWord],
) -> tuple[tuple[PositionalWord, ...], ...]:
    lines: list[list[PositionalWord]] = []
    for word in sorted(words, key=lambda item: (item.center_y, item.left, item.order)):
        selected: list[PositionalWord] | None = None
        for line in reversed(lines):
            line_top = min(item.top for item in line)
            line_bottom = max(item.bottom for item in line)
            line_height = max(1, line_bottom - line_top)
            overlap = min(line_bottom, word.bottom) - max(line_top, word.top)
            center_delta = abs(
                word.center_y
                - sum(item.center_y for item in line) / len(line)
            )
            if overlap > 0 or center_delta <= max(line_height, word.height) * 0.6:
                selected = line
                break
        if selected is None:
            lines.append([word])
        else:
            selected.append(word)
    ordered = [
        tuple(sorted(line, key=lambda item: (item.left, item.order)))
        for line in lines
    ]
    return tuple(sorted(ordered, key=lambda line: min(word.top for word in line)))


def _find_labels(
    words: Sequence[PositionalWord],
) -> tuple[_LabelMatch, ...]:
    matches: list[_LabelMatch] = []
    for line in _visual_lines(words):
        normalized = tuple(word.normalized for word in line)
        occupied: set[int] = set()
        for label_type, phrase in LABELS:
            length = len(phrase)
            for start in range(0, len(line) - length + 1):
                indexes = set(range(start, start + length))
                if indexes & occupied:
                    continue
                if normalized[start : start + length] != phrase:
                    continue
                matches.append(
                    _LabelMatch(
                        label_type=label_type,
                        label_words=tuple(line[start : start + length]),
                        visual_line=line,
                    )
                )
                occupied.update(indexes)
    return tuple(matches)


def _preferred_labels(
    matches: Sequence[_LabelMatch],
) -> tuple[_LabelMatch, ...]:
    """Return only the most specific approved label matches.

    A Grade Form can contain a generic ``GWA`` heading elsewhere on the page
    in addition to the actual ``Cumulative GWA`` result line. Treating every
    approved label as an equal source makes the fallback crop ambiguous before
    the value crop is even attempted. The configured LABELS order is the
    specificity order, so a more specific label suppresses generic matches.

    Multiple matches of the same most-specific label are retained. The caller
    must still reject them when no unique value source can be established.
    """

    if not matches:
        return ()

    priority = {label_type: index for index, (label_type, _) in enumerate(LABELS)}
    best_priority = min(
        priority.get(match.label_type, len(priority))
        for match in matches
    )

    selected: list[_LabelMatch] = []
    seen_geometry: set[tuple[str, tuple[tuple[int, int, int, int], ...]]] = set()

    for match in matches:
        if priority.get(match.label_type, len(priority)) != best_priority:
            continue

        geometry = (
            match.label_type,
            tuple(
                (word.left, word.top, word.width, word.height)
                for word in match.label_words
            ),
        )
        if geometry in seen_geometry:
            continue

        seen_geometry.add(geometry)
        selected.append(match)

    return tuple(selected)


def _numeric_token(value: Any) -> str | None:
    candidate = str(value or "").strip()
    candidate = re.sub(r"^[^0-9]+|[^0-9]+$", "", candidate)
    if not re.fullmatch(r"[1-5]\.\d{2}", candidate):
        return None
    return candidate


def _validated_value(value: Any) -> tuple[str, str] | None:
    candidate = _numeric_token(value)
    if candidate is None:
        return None
    try:
        numeric = Decimal(candidate)
    except InvalidOperation:
        return None
    if not Decimal("1.00") <= numeric <= Decimal("5.00"):
        return None
    return candidate, format(numeric, ".2f")


def _recoverable_three_digit_value(value: Any) -> tuple[str, str] | None:
    observation = re.sub(
        r"^[^0-9]+|[^0-9]+$",
        "",
        str(value or "").strip(),
    )
    if not re.fullmatch(r"[1-5]\d{2}", observation):
        return None
    normalized = f"{observation[0]}.{observation[1:]}"
    validated = _validated_value(normalized)
    if validated is None:
        return None
    return observation, validated[1]


def _numeric_observations(value: Any) -> tuple[str, ...]:
    """Return privacy-safe numeric observations from one crop OCR attempt.

    Tesseract can omit or separate a faint decimal mark and return the three
    GWA digits as multiple fragments, for example ``1 68``. Preserve the
    original numeric fragments, but also add one combined three-digit
    observation when the entire OCR response contains exactly three digits.

    The combined observation is only a recovery *candidate*. It is never
    accepted unless another OCR variant reads the direct decimal or the image
    contains independent connected-component evidence for the decimal mark.
    """

    raw = str(value or "")
    observations: list[str] = []

    for token in re.findall(r"[0-9.]+", raw):
        if token and any(character.isdigit() for character in token):
            observations.append(token)

    has_direct_valid_decimal = any(
        _validated_value(token) is not None
        for token in observations
    )
    all_digits = "".join(character for character in raw if character.isdigit())
    if (
        not has_direct_valid_decimal
        and len(all_digits) == 3
        and all_digits not in observations
    ):
        observations.append(all_digits)

    return tuple(observations)


def _value_variants(
    crop: np.ndarray,
    upscale_factor: int,
) -> tuple[tuple[str, np.ndarray], ...]:
    upscaled = cv2.resize(
        crop,
        None,
        fx=upscale_factor,
        fy=upscale_factor,
        interpolation=cv2.INTER_CUBIC,
    )
    _, otsu = cv2.threshold(
        upscaled,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    adaptive = cv2.adaptiveThreshold(
        upscaled,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        9,
    )
    return (
        ("grayscale", upscaled),
        ("otsu_threshold", otsu),
        ("adaptive_threshold", adaptive),
    )


def _decimal_component_detected(image: np.ndarray) -> bool:
    _, foreground = cv2.threshold(
        image,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
    )
    count, _, stats, centroids = cv2.connectedComponentsWithStats(
        foreground,
        connectivity=8,
    )
    components = []
    for index in range(1, count):
        left, top, width, height, area = (
            int(value) for value in stats[index]
        )
        if area < 3 or width <= 0 or height <= 0:
            continue
        components.append(
            {
                "left": left,
                "top": top,
                "right": left + width,
                "bottom": top + height,
                "width": width,
                "height": height,
                "area": area,
                "center_x": float(centroids[index][0]),
                "center_y": float(centroids[index][1]),
            }
        )
    if len(components) < 4:
        return False

    maximum_height = max(component["height"] for component in components)
    digit_components = [
        component
        for component in components
        if component["height"] >= maximum_height * 0.55
        and component["area"] >= 12
    ]
    if len(digit_components) < 3:
        return False
    digit_components = sorted(
        digit_components,
        key=lambda component: component["left"],
    )[:3]
    first, second = digit_components[:2]
    median_height = sorted(
        component["height"] for component in digit_components
    )[1]
    median_width = sorted(
        component["width"] for component in digit_components
    )[1]
    lower_text_y = min(
        component["bottom"] for component in digit_components
    ) - (median_height * 0.45)

    return any(
        first["right"] <= component["center_x"] <= second["left"]
        and component["center_y"] >= lower_text_y
        and component["height"] <= median_height * 0.35
        and component["width"] <= max(2.0, median_width * 0.45)
        and component not in digit_components
        for component in components
    )


def _nearby_words(match: _LabelMatch, image_width: int) -> tuple[PositionalWord, ...]:
    label_right = max(word.right for word in match.label_words)
    label_top = min(word.top for word in match.label_words)
    label_bottom = max(word.bottom for word in match.label_words)
    label_height = max(1, label_bottom - label_top)
    maximum_right = min(
        image_width,
        label_right + max(int(image_width * 0.28), label_height * 12),
    )
    return tuple(
        word
        for word in match.visual_line
        if word.left >= label_right
        and word.left <= maximum_right
        and word not in match.label_words
    )


def _normalized_bounds(
    left: int,
    top: int,
    right: int,
    bottom: int,
    image_width: int,
    image_height: int,
) -> tuple[float, float, float, float]:
    return (
        left / float(image_width),
        top / float(image_height),
        (right - left) / float(image_width),
        (bottom - top) / float(image_height),
    )


def _word_bounds(
    word: PositionalWord,
    image_width: int,
    image_height: int,
) -> tuple[float, float, float, float]:
    return _normalized_bounds(
        word.left,
        word.top,
        word.right,
        word.bottom,
        image_width,
        image_height,
    )


def _direct_positional_candidates(
    matches: Sequence[_LabelMatch],
    image_width: int,
    image_height: int,
) -> tuple[tuple[_LabelMatch, PositionalWord, str, str], ...]:
    """Return direct same-line decimal values beside approved labels.

    A form may contain a blank, more-specific label such as ``Cumulative GWA``
    while the actual printed result appears on another approved line such as
    ``GWA: 1.68``. Label specificity must not suppress an already recognized,
    valid same-line decimal. Only exact direct decimals within the configured
    grading scale are returned here; integer candidates still go through the
    bounded crop OCR and decimal-evidence path.
    """

    candidates: list[tuple[_LabelMatch, PositionalWord, str, str]] = []
    seen: set[tuple[str, int, int, str]] = set()

    for match in matches:
        for word in _nearby_words(match, image_width):
            validated = _validated_value(word.text)
            if validated is None:
                continue
            raw_value, normalized = validated
            key = (match.label_type, word.left, word.top, normalized)
            if key in seen:
                continue
            seen.add(key)
            candidates.append((match, word, raw_value, normalized))

    return tuple(candidates)


def _crop_bounds(
    match: _LabelMatch,
    image_width: int,
    image_height: int,
    config: GradeFormGWAConfig,
) -> tuple[int, int, int, int]:
    label_right = max(word.right for word in match.label_words)
    label_top = min(word.top for word in match.label_words)
    label_bottom = max(word.bottom for word in match.label_words)
    label_height = max(1, label_bottom - label_top)
    padding = int(round(label_height * config.value_region_vertical_padding))
    numeric_words = tuple(
        word
        for word in _nearby_words(match, image_width)
        if any(character.isdigit() for character in word.text)
    )
    if numeric_words:
        horizontal_padding = max(2, label_height // 2)
        left = max(
            label_right + 1,
            min(word.left for word in numeric_words) - horizontal_padding,
        )
        right = min(
            image_width,
            max(word.right for word in numeric_words) + horizontal_padding,
        )
        top = max(
            0,
            min(word.top for word in numeric_words) - padding,
        )
        bottom = min(
            image_height,
            max(word.bottom for word in numeric_words) + padding,
        )
        return left, top, right, bottom

    left = min(image_width, label_right + max(1, label_height // 4))
    right = min(
        image_width,
        left + max(label_height * 8, int(image_width * config.value_region_width_ratio)),
    )
    top = max(0, label_top - padding)
    bottom = min(image_height, label_bottom + padding)
    return left, top, right, bottom


def _raw_text(words: Sequence[PositionalWord]) -> str:
    return "\n".join(
        " ".join(word.text for word in line)
        for line in _visual_lines(words)
    )


def _field_failure(
    code: str,
    *,
    label_type: str = "",
    bounds: tuple[float, float, float, float] | None = None,
) -> GradeFormGWAFieldResult:
    return GradeFormGWAFieldResult(
        field_name=FIELD_NAME,
        raw_text="",
        normalized_value=None,
        success=False,
        review_required=True,
        issue_codes=(code,),
        value_source="none",
        normalization_applied=False,
        normalization_type="none",
        decimal_evidence_detected=False,
        label_type=label_type,
        normalized_bounds=bounds,
    )


def _candidate_field_failure(
    code: str,
    candidate: Any,
    *,
    label_type: str,
    bounds: tuple[float, float, float, float] | None,
) -> GradeFormGWAFieldResult:
    """Preserve one label-bound OCR candidate without validating it as GWA."""

    sanitized = re.sub(r"[^0-9.]+", "", str(candidate or "").strip())
    if not sanitized or not any(character.isdigit() for character in sanitized):
        return _field_failure(code, label_type=label_type, bounds=bounds)

    return GradeFormGWAFieldResult(
        field_name=FIELD_NAME,
        raw_text=sanitized[:16],
        normalized_value=None,
        success=False,
        review_required=True,
        issue_codes=(code,),
        value_source="crop_ocr_candidate",
        normalization_applied=False,
        normalization_type="none",
        decimal_evidence_detected=False,
        label_type=label_type,
        normalized_bounds=bounds,
    )


def _stage(
    field: GradeFormGWAFieldResult,
    raw_text: str,
    issues: Sequence[dict[str, str]],
    *,
    positional_seconds: float,
    crop_seconds: float,
    processing_seconds: float,
    word_count: int,
    label_count: int,
    value_candidate_count: int,
    ocr_attempt_count: int,
) -> StageResult[GradeFormGWAOutput]:
    return StageResult(
        stage=STAGE_NAME,
        success=field.success,
        status="review_required",
        data=GradeFormGWAOutput(
            field=field,
            raw_text=raw_text,
            detection_variant="upright_positional_label",
        ),
        issues=list(issues),
        metrics={
            "processing_seconds": round(processing_seconds, 6),
            "positional_ocr_seconds": round(positional_seconds, 6),
            "field_crop_ocr_seconds": round(crop_seconds, 6),
            "word_count": int(word_count),
            "label_count": int(label_count),
            "value_candidate_count": int(value_candidate_count),
            "ocr_attempt_count": int(ocr_attempt_count),
            "manual_review_required": True,
            "upright_only": True,
        },
    )


def extract_grade_form_gwa(
    image: Any,
    config: GradeFormGWAConfig | Mapping[str, Any] | None = None,
    *,
    word_reader: WordReader | None = None,
    value_reader: ValueReader | None = None,
) -> StageResult[GradeFormGWAOutput]:
    started = time.monotonic()
    positional_seconds = 0.0
    crop_seconds = 0.0
    ocr_attempt_count = 0
    words: tuple[PositionalWord, ...] = ()
    labels: tuple[_LabelMatch, ...] = ()
    raw_text = ""

    try:
        resolved = _resolve_config(config)
        working = _prepare_image(image, resolved.maximum_dimension)
    except (TypeError, ValueError):
        field = _field_failure("gwa_value_not_found")
        return _stage(
            field,
            "",
            [_issue("gwa_value_not_found")],
            positional_seconds=0.0,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=0,
            label_count=0,
            value_candidate_count=0,
            ocr_attempt_count=0,
        )

    resolved_word_reader = word_reader or _default_word_reader
    positional_started = time.monotonic()
    ocr_attempt_count += 1
    try:
        data = resolved_word_reader(working, resolved)
        words = _parse_words(data, resolved.minimum_word_confidence)
        raw_text = _raw_text(words)
        labels = _find_labels(words)
    except (RuntimeError, pytesseract.TesseractError):
        positional_seconds = time.monotonic() - positional_started
        field = _field_failure("gwa_ocr_timeout")
        return _stage(
            field,
            "",
            [_issue("gwa_ocr_timeout")],
            positional_seconds=positional_seconds,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=0,
            label_count=0,
            value_candidate_count=0,
            ocr_attempt_count=1,
        )
    except Exception:
        positional_seconds = time.monotonic() - positional_started
        field = _field_failure("gwa_value_not_found")
        return _stage(
            field,
            "",
            [_issue("gwa_value_not_found")],
            positional_seconds=positional_seconds,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=0,
            label_count=0,
            value_candidate_count=0,
            ocr_attempt_count=1,
        )
    positional_seconds = time.monotonic() - positional_started

    if not labels:
        field = _field_failure("gwa_label_not_found")
        return _stage(
            field,
            raw_text,
            [_issue("gwa_label_not_found")],
            positional_seconds=positional_seconds,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=0,
            value_candidate_count=0,
            ocr_attempt_count=ocr_attempt_count,
        )

    image_height, image_width = working.shape[:2]

    positional_candidates = _direct_positional_candidates(
        labels,
        image_width,
        image_height,
    )
    positional_values = {
        candidate[3]
        for candidate in positional_candidates
    }

    if len(positional_values) > 1:
        field = _field_failure("gwa_source_conflict")
        return _stage(
            field,
            raw_text,
            [_issue("gwa_source_conflict")],
            positional_seconds=positional_seconds,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=len(labels),
            value_candidate_count=len(positional_candidates),
            ocr_attempt_count=ocr_attempt_count,
        )

    if len(positional_values) == 1:
        normalized = next(iter(positional_values))
        selected = next(
            candidate
            for candidate in positional_candidates
            if candidate[3] == normalized
        )
        label, value_word, raw_observation, _ = selected
        field = GradeFormGWAFieldResult(
            field_name=FIELD_NAME,
            raw_text=raw_observation,
            normalized_value=normalized,
            success=True,
            review_required=True,
            issue_codes=(),
            value_source="positional",
            normalization_applied=False,
            normalization_type="none",
            decimal_evidence_detected=True,
            label_type=label.label_type,
            normalized_bounds=_word_bounds(
                value_word,
                image_width,
                image_height,
            ),
        )
        return _stage(
            field,
            raw_text,
            [],
            positional_seconds=positional_seconds,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=len(labels),
            value_candidate_count=len(positional_candidates),
            ocr_attempt_count=ocr_attempt_count,
        )

    preferred_labels = _preferred_labels(labels)
    if len(preferred_labels) != 1:
        code = "gwa_value_ambiguous"
        label_type = preferred_labels[0].label_type if preferred_labels else ""
        field = _field_failure(code, label_type=label_type)
        return _stage(
            field,
            raw_text,
            [_issue(code)],
            positional_seconds=positional_seconds,
            crop_seconds=0.0,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=len(labels),
            value_candidate_count=0,
            ocr_attempt_count=ocr_attempt_count,
        )

    label = preferred_labels[0]
    left, top, right, bottom = _crop_bounds(
        label,
        image_width,
        image_height,
        resolved,
    )
    crop_normalized_bounds = _normalized_bounds(
        left,
        top,
        right,
        bottom,
        image_width,
        image_height,
    )

    def fail(
        code: str,
        *,
        candidate: Any = "",
    ) -> StageResult[GradeFormGWAOutput]:
        if candidate:
            field = _candidate_field_failure(
                code,
                candidate,
                label_type=label.label_type,
                bounds=crop_normalized_bounds,
            )
        else:
            field = _field_failure(
                code,
                label_type=label.label_type,
                bounds=crop_normalized_bounds,
            )
        return _stage(
            field,
            raw_text,
            [_issue(code)],
            positional_seconds=positional_seconds,
            crop_seconds=crop_seconds,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=len(labels),
            value_candidate_count=len(observations),
            ocr_attempt_count=ocr_attempt_count,
        )

    if right <= left or bottom <= top:
        observations: list[tuple[str, str]] = []
        return fail("gwa_value_not_found")

    crop = working[top:bottom, left:right].copy()
    variants = _value_variants(crop, resolved.crop_upscale_factor)
    grayscale_variant = variants[0][1]
    reader = value_reader or _default_value_reader
    observations = []
    crop_started = time.monotonic()
    timed_out = False

    for index, (variant_name, variant_image) in enumerate(variants):
        remaining = resolved.total_timeout_seconds - (
            time.monotonic() - started
        )
        if remaining <= 0.1:
            timed_out = True
            break
        remaining_attempts = len(variants) - index
        attempt_timeout = min(
            resolved.crop_timeout_seconds,
            max(0.1, remaining / remaining_attempts),
        )
        ocr_attempt_count += 1
        try:
            value = reader(
                variant_image.copy(),
                variant_name,
                resolved,
                attempt_timeout,
            )
            observations.extend(
                (variant_name, token)
                for token in _numeric_observations(value)
            )
        except (RuntimeError, pytesseract.TesseractError):
            timed_out = True
        except Exception:
            continue
    crop_seconds = time.monotonic() - crop_started

    direct_candidates = [
        (variant, token, parsed)
        for variant, token in observations
        if (parsed := _validated_value(token)) is not None
    ]
    recovery_candidates = [
        (variant, token, recovered)
        for variant, token in observations
        if (recovered := _recoverable_three_digit_value(token)) is not None
    ]
    possible_values = {
        parsed[1] for _, _, parsed in direct_candidates
    } | {
        recovered[1] for _, _, recovered in recovery_candidates
    }

    if len(possible_values) > 1:
        return fail("gwa_source_conflict")

    if direct_candidates:
        normalized = next(iter(possible_values))
        matching_recovery = next(
            (
                candidate
                for candidate in recovery_candidates
                if candidate[2][1] == normalized
            ),
            None,
        )
        if matching_recovery is not None:
            raw_observation = matching_recovery[1]
            field = GradeFormGWAFieldResult(
                field_name=FIELD_NAME,
                raw_text=raw_observation,
                normalized_value=normalized,
                success=True,
                review_required=True,
                issue_codes=(),
                value_source="crop_ocr_decimal_recovery",
                normalization_applied=True,
                normalization_type="missing_decimal_recovered",
                decimal_evidence_detected=True,
                label_type=label.label_type,
                normalized_bounds=crop_normalized_bounds,
            )
        else:
            raw_observation = direct_candidates[0][2][0]
            field = GradeFormGWAFieldResult(
                field_name=FIELD_NAME,
                raw_text=raw_observation,
                normalized_value=normalized,
                success=True,
                review_required=True,
                issue_codes=(),
                value_source="crop_ocr",
                normalization_applied=False,
                normalization_type="none",
                decimal_evidence_detected=True,
                label_type=label.label_type,
                normalized_bounds=crop_normalized_bounds,
            )
        return _stage(
            field,
            raw_text,
            [],
            positional_seconds=positional_seconds,
            crop_seconds=crop_seconds,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=len(labels),
            value_candidate_count=len(observations),
            ocr_attempt_count=ocr_attempt_count,
        )

    if recovery_candidates:
        if len(possible_values) != 1:
            return fail("gwa_source_conflict")
        if not _decimal_component_detected(grayscale_variant):
            return fail(
                "gwa_decimal_not_confirmed",
                candidate=recovery_candidates[0][1],
            )
        raw_observation = recovery_candidates[0][1]
        normalized = recovery_candidates[0][2][1]
        field = GradeFormGWAFieldResult(
            field_name=FIELD_NAME,
            raw_text=raw_observation,
            normalized_value=normalized,
            success=True,
            review_required=True,
            issue_codes=(),
            value_source="crop_ocr_decimal_recovery",
            normalization_applied=True,
            normalization_type="missing_decimal_recovered",
            decimal_evidence_detected=True,
            label_type=label.label_type,
            normalized_bounds=crop_normalized_bounds,
        )
        return _stage(
            field,
            raw_text,
            [],
            positional_seconds=positional_seconds,
            crop_seconds=crop_seconds,
            processing_seconds=time.monotonic() - started,
            word_count=len(words),
            label_count=len(labels),
            value_candidate_count=len(observations),
            ocr_attempt_count=ocr_attempt_count,
        )

    if timed_out and not observations:
        return fail("gwa_ocr_timeout")
    if observations:
        unique_observations = {
            re.sub(r"[^0-9.]+", "", token)
            for _, token in observations
            if re.sub(r"[^0-9.]+", "", token)
        }
        if len(unique_observations) == 1:
            return fail(
                "gwa_value_out_of_range",
                candidate=next(iter(unique_observations)),
            )
        return fail("gwa_value_out_of_range")
    return fail("gwa_value_not_found")
