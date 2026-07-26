from __future__ import annotations

import math
import re
import time
import unicodedata
from dataclasses import dataclass, replace
from datetime import date
from types import MappingProxyType
from typing import Any, Callable, Mapping, Sequence

import cv2
import numpy as np
import pytesseract

from .ocr_engine import (
    OCRBinaryUnavailableError,
    OCRExecutionError,
    OCRInputError,
)
from .stage_result import StageResult


STAGE_NAME = "indigency_core_field_extraction"
REQUIRED_FIELDS = (
    "certificate_subject_name",
    "issue_date",
    "issuing_barangay",
)
TITLE_PHRASES = (
    ("certificate", "of", "indigency"),
    ("certification", "of", "indigency"),
)
SUBJECT_ANCHOR = ("this", "is", "to", "certify", "that")
DATE_ANCHORS = (("given", "this"), ("issued", "this"))


@dataclass(frozen=True)
class IndigencyExtractionConfig:
    language: str = "eng"
    oem: int = 3
    page_segmentation_mode: int = 6
    screen_page_segmentation_mode: int = 11
    minimum_word_confidence: float = 15.0
    title_maximum_y: float = 0.45
    elevated_deskew_degrees: float = 3.0
    maximum_deskew_degrees: float = 7.0
    crop_padding_pixels: int = 4
    maximum_barangay_length: int = 80
    minimum_leading_word_confidence: float = 85.0
    maximum_trailing_noise_confidence: float = 40.0
    minimum_confidence_drop: float = 40.0
    minimum_detached_gap_ratio: float = 2.0
    maximum_detached_tokens_removed: int = 1
    screening_maximum_dimension: int = 850
    fallback_screening_maximum_dimension: int = 700
    minimum_screen_word_count: int = 12
    screen_timeout_seconds: float = 4.0
    screening_budget_seconds: float = 14.0
    crop_timeout_seconds: float = 5.0
    field_crop_budget_seconds: float = 12.0
    total_request_timeout_seconds: float = 35.0
    external_hard_timeout_seconds: float = 40.0
    maximum_candidate_attempts: int = 7


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


@dataclass(frozen=True)
class IndigencyFieldDiagnostics:
    candidate_found: bool
    candidate_count: int
    candidate_token_count: int
    candidate_word_confidences: tuple[float, ...]
    candidate_horizontal_gaps: tuple[int, ...]
    candidate_gap_ratios: tuple[float, ...]
    candidate_word_count_before_filter: int
    candidate_word_count_after_filter: int
    token_filter_status: str
    removed_token_count: int
    candidate_source: str
    anchor_found: bool
    bounds_present: bool
    crop_attempted: bool
    crop_returned_text: bool
    value_source: str
    positional_validation_status: str
    crop_validation_status: str
    failure_stage: str


@dataclass(frozen=True)
class IndigencyFieldResult:
    name: str
    raw_text: str
    success: bool
    review_required: bool
    issue_codes: tuple[str, ...]
    detection_variant: str
    anchor: str
    normalized_bounds: tuple[float, float, float, float] | None
    diagnostics: IndigencyFieldDiagnostics | None = None


@dataclass(frozen=True)
class IndigencyExtractionOutput:
    fields: tuple[IndigencyFieldResult, ...]
    field_count: int
    raw_text: str
    detection_variant: str
    selected_orientation: str
    selected_detection_variant: str
    candidate_count: int
    deskew_angle_degrees: float
    title_anchor: str
    anchor_metadata: Mapping[str, Mapping[str, Any]]


@dataclass(frozen=True)
class ScreeningPass:
    orientation: str
    page_segmentation_mode: int
    variant: str
    words: tuple[PositionalWord, ...]
    score: tuple[int, int, int, int, int]
    screen_shape: tuple[int, ...]

    @property
    def source_name(self) -> str:
        return f"{self.variant}_psm{self.page_segmentation_mode}"


@dataclass(frozen=True)
class FieldEvidence:
    screening_pass: ScreeningPass
    words: tuple[PositionalWord, ...]
    anchor: str
    comparison_value: str
    positional_value_valid: bool


WordReader = Callable[[np.ndarray, str, IndigencyExtractionConfig], Mapping[str, Sequence[Any]]]
FieldReader = Callable[[np.ndarray, str], Any]


def _issue(code: str, field: str = "") -> dict[str, str]:
    return {"code": code, "stage": STAGE_NAME, "field": field}


def _empty_field(name: str, variant: str, *codes: str) -> IndigencyFieldResult:
    return IndigencyFieldResult(
        name=name,
        raw_text="",
        success=False,
        review_required=True,
        issue_codes=tuple(codes),
        detection_variant=variant,
        anchor="",
        normalized_bounds=None,
    )


def _normalize_token(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _normalize_field_text(value: Any) -> str:
    text = "" if value is None else str(value)
    return re.sub(r"\s+", " ", text.replace("\r", " ").replace("\n", " ")).strip()


def _validate_image(image: Any) -> np.ndarray:
    if not isinstance(image, np.ndarray) or image.dtype != np.uint8:
        raise OCRInputError("image must be a uint8 numpy array")
    if image.size == 0 or image.ndim not in (2, 3):
        raise OCRInputError("image must be non-empty grayscale, BGR, or BGRA")
    if image.ndim == 3 and image.shape[2] not in (3, 4):
        raise OCRInputError("unsupported channel count")
    return np.ascontiguousarray(image.copy())


def _orientation_candidates(
    image: np.ndarray,
) -> tuple[tuple[str, np.ndarray], ...]:
    return (
        ("original", image.copy()),
        ("clockwise_90", cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)),
        (
            "counterclockwise_90",
            cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE),
        ),
        ("180", cv2.rotate(image, cv2.ROTATE_180)),
    )


def _oriented_image(image: np.ndarray, orientation: str) -> np.ndarray:
    candidates = dict(_orientation_candidates(image))
    if orientation not in candidates:
        raise ValueError("unsupported orientation")
    return candidates[orientation]


def _resize_for_screening(image: np.ndarray, maximum_dimension: int) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= maximum_dimension:
        return image.copy()
    scale = maximum_dimension / float(longest)
    target = (
        max(1, int(round(width * scale))),
        max(1, int(round(height * scale))),
    )
    return cv2.resize(image, target, interpolation=cv2.INTER_AREA)


def _grayscale(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image.copy()
    code = cv2.COLOR_BGR2GRAY if image.shape[2] == 3 else cv2.COLOR_BGRA2GRAY
    return cv2.cvtColor(image, code)


def _estimate_deskew_angle(image: np.ndarray, maximum: float) -> float:
    gray = _grayscale(image)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    minimum_length = max(40, image.shape[1] // 5)
    lines = cv2.HoughLinesP(
        binary,
        1,
        np.pi / 1800.0,
        threshold=max(30, image.shape[1] // 12),
        minLineLength=minimum_length,
        maxLineGap=max(8, image.shape[1] // 80),
    )
    if lines is None:
        return 0.0

    angles: list[float] = []
    for line in lines[:, 0]:
        x1, y1, x2, y2 = (int(value) for value in line)
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        if abs(angle) <= maximum:
            angles.append(angle)
    return float(np.median(angles)) if angles else 0.0


def _deskew(image: np.ndarray, angle: float) -> np.ndarray:
    if abs(angle) < 0.05:
        return image.copy()
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2.0, height / 2.0), angle, 1.0)
    border = 255 if image.ndim == 2 else tuple([255] * image.shape[2])
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border,
    )


def _detection_variants(image: np.ndarray) -> tuple[tuple[str, np.ndarray], ...]:
    gray = _grayscale(image)
    _, threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return (("grayscale", gray), ("otsu_threshold", threshold))


def _default_word_reader(
    image: np.ndarray,
    _variant: str,
    config: IndigencyExtractionConfig,
) -> Mapping[str, Sequence[Any]]:
    tesseract_config = (
        f"--oem {config.oem} "
        f"--psm {config.page_segmentation_mode}"
    )
    return pytesseract.image_to_data(
        image,
        lang=config.language,
        config=tesseract_config,
        output_type=pytesseract.Output.DICT,
        timeout=config.screen_timeout_seconds,
    )


def _default_field_reader(
    image: np.ndarray,
    _field_name: str,
    config: IndigencyExtractionConfig,
    timeout_seconds: float | None = None,
) -> str:
    tesseract_config = f"--oem {config.oem} --psm {config.page_segmentation_mode}"
    timeout = (
        config.crop_timeout_seconds
        if timeout_seconds is None
        else max(0.1, min(config.crop_timeout_seconds, timeout_seconds))
    )
    started = time.monotonic()
    gray = _grayscale(image)
    text = pytesseract.image_to_string(
        gray,
        lang=config.language,
        config=tesseract_config,
        timeout=timeout,
    )
    if _normalize_field_text(text):
        return text
    remaining = timeout - (time.monotonic() - started)
    if remaining <= 0.1:
        return ""
    _, threshold = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    return pytesseract.image_to_string(
        threshold,
        lang=config.language,
        config=tesseract_config,
        timeout=remaining,
    )


def _parse_words(
    data: Mapping[str, Sequence[Any]],
    config: IndigencyExtractionConfig,
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
        raise ValueError("word data is missing required columns")
    size = len(data["text"])
    if any(len(data[key]) != size for key in required):
        raise ValueError("word data columns have inconsistent lengths")

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
        except (TypeError, ValueError) as exc:
            raise ValueError("word data contains invalid geometry") from exc
        if not normalized or confidence < config.minimum_word_confidence:
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
                block=int(data["block_num"][index]),
                paragraph=int(data["par_num"][index]),
                line=int(data["line_num"][index]),
                order=index,
            )
        )
    return tuple(sorted(words, key=lambda word: (word.top, word.left, word.order)))


def _find_phrase(words: Sequence[PositionalWord], phrase: Sequence[str]) -> list[int]:
    normalized = [word.normalized for word in words]
    phrase_tuple = tuple(phrase)
    return [
        index
        for index in range(0, len(words) - len(phrase_tuple) + 1)
        if tuple(normalized[index : index + len(phrase_tuple)]) == phrase_tuple
    ]


def _group_paragraphs(words: Sequence[PositionalWord]) -> tuple[tuple[PositionalWord, ...], ...]:
    groups: dict[tuple[int, int], list[PositionalWord]] = {}
    for word in words:
        groups.setdefault((word.block, word.paragraph), []).append(word)
    ordered = [
        tuple(sorted(group, key=lambda word: (word.line, word.left, word.order)))
        for group in groups.values()
    ]
    return tuple(sorted(ordered, key=lambda group: min(word.top for word in group)))


def _positional_raw_text(words: Sequence[PositionalWord]) -> str:
    lines: dict[tuple[int, int, int], list[PositionalWord]] = {}
    for word in words:
        lines.setdefault((word.block, word.paragraph, word.line), []).append(word)
    ordered_lines = sorted(
        lines.values(),
        key=lambda line: (
            min(word.top for word in line),
            min(word.left for word in line),
        ),
    )
    return "\n".join(
        " ".join(word.text for word in sorted(line, key=lambda word: word.left))
        for line in ordered_lines
    ).strip()


def _title_candidate(
    words: Sequence[PositionalWord],
    image_height: int,
    maximum_y: float,
) -> tuple[PositionalWord, ...] | None:
    candidates: list[tuple[PositionalWord, ...]] = []
    lines: dict[tuple[int, int, int], list[PositionalWord]] = {}
    for word in words:
        lines.setdefault((word.block, word.paragraph, word.line), []).append(word)
    for line_words in lines.values():
        line = tuple(sorted(line_words, key=lambda word: word.left))
        if max(word.bottom for word in line) / image_height > maximum_y:
            continue
        for phrase in TITLE_PHRASES:
            for index in _find_phrase(line, phrase):
                candidates.append(line[index : index + len(phrase)])
    if not candidates:
        return None
    return min(candidates, key=lambda candidate: min(word.top for word in candidate))


def _variant_score(
    words: Sequence[PositionalWord],
    image_height: int,
    config: IndigencyExtractionConfig,
) -> tuple[int, int, int, int, int]:
    title_present = int(
        _title_candidate(words, image_height, config.title_maximum_y) is not None
    )
    paragraphs = _group_paragraphs(words)
    subject_present = int(
        any(_find_phrase(paragraph, SUBJECT_ANCHOR) for paragraph in paragraphs)
    )
    date_present = int(
        any(
            any(_find_phrase(paragraph, anchor) for anchor in DATE_ANCHORS)
            for paragraph in paragraphs
        )
    )
    title = _title_candidate(words, image_height, config.title_maximum_y)
    barangay_present = int(
        title is not None
        and len(_issuing_barangay_candidates(words, title)) == 1
    )
    return (
        title_present,
        subject_present,
        date_present,
        barangay_present,
        len(words),
    )


def _complete_structural_evidence(
    score: Sequence[int],
    config: IndigencyExtractionConfig,
) -> bool:
    return (
        len(score) == 5
        and tuple(score[:3]) == (1, 1, 1)
        and score[4] >= config.minimum_screen_word_count
    )


def _fused_structural_score(
    passes: Sequence[ScreeningPass],
) -> tuple[int, int, int, int, int]:
    if not passes:
        return (0, 0, 0, 0, 0)
    return (
        max(item.score[0] for item in passes),
        max(item.score[1] for item in passes),
        max(item.score[2] for item in passes),
        max(item.score[3] for item in passes),
        max(item.score[4] for item in passes),
    )


def _meaningful_structural_evidence(
    screening_pass: ScreeningPass,
    config: IndigencyExtractionConfig,
) -> bool:
    return (
        any(screening_pass.score[:4])
        and screening_pass.score[4] >= config.minimum_screen_word_count
    )


def _complete_fused_evidence(
    passes: Sequence[ScreeningPass],
    config: IndigencyExtractionConfig,
) -> bool:
    return _complete_structural_evidence(
        _fused_structural_score(passes),
        config,
    )


def _structural_rank(screening_pass: ScreeningPass) -> int:
    return sum(screening_pass.score[:4])


def _comparison_key(value: Any) -> str:
    normalized = _normalize_field_text(value).casefold()
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def _map_words_to_image(
    words: Sequence[PositionalWord],
    source_shape: tuple[int, ...],
    target_shape: tuple[int, ...],
) -> tuple[PositionalWord, ...]:
    source_height, source_width = source_shape[:2]
    target_height, target_width = target_shape[:2]
    scale_x = target_width / float(source_width)
    scale_y = target_height / float(source_height)
    return tuple(
        PositionalWord(
            text=word.text,
            normalized=word.normalized,
            confidence=word.confidence,
            left=max(0, int(round(word.left * scale_x))),
            top=max(0, int(round(word.top * scale_y))),
            width=max(1, int(round(word.width * scale_x))),
            height=max(1, int(round(word.height * scale_y))),
            block=word.block,
            paragraph=word.paragraph,
            line=word.line,
            order=word.order,
        )
        for word in words
    )


def _bounds(words: Sequence[PositionalWord], image_shape: tuple[int, ...]) -> tuple[int, int, int, int]:
    height, width = image_shape[:2]
    return (
        max(0, min(word.left for word in words)),
        max(0, min(word.top for word in words)),
        min(width, max(word.right for word in words)),
        min(height, max(word.bottom for word in words)),
    )


def _normalized_bounds(
    bounds: tuple[int, int, int, int],
    image_shape: tuple[int, ...],
) -> tuple[float, float, float, float]:
    left, top, right, bottom = bounds
    height, width = image_shape[:2]
    return (
        left / width,
        top / height,
        (right - left) / width,
        (bottom - top) / height,
    )


def _crop(
    image: np.ndarray,
    bounds: tuple[int, int, int, int],
    padding: int,
) -> np.ndarray:
    left, top, right, bottom = bounds
    height, width = image.shape[:2]
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(width, right + padding)
    bottom = min(height, bottom + padding)
    return image[top:bottom, left:right].copy()


def _subject_paragraphs(paragraphs: Sequence[Sequence[PositionalWord]]) -> list[tuple[PositionalWord, ...]]:
    return [tuple(paragraph) for paragraph in paragraphs if _find_phrase(paragraph, SUBJECT_ANCHOR)]


def _find_resident_index(words: Sequence[PositionalWord], start: int) -> int | None:
    for index in range(start, len(words)):
        if words[index].normalized in {"resident", "residing"}:
            return index
    return None


def _subject_words(paragraph: Sequence[PositionalWord]) -> tuple[PositionalWord, ...] | None:
    matches = _find_phrase(paragraph, SUBJECT_ANCHOR)
    if len(matches) != 1:
        return None
    start = matches[0] + len(SUBJECT_ANCHOR)
    resident = _find_resident_index(paragraph, start)
    stop = resident if resident is not None else len(paragraph)
    for index in range(start, stop):
        token = paragraph[index].normalized
        next_token = paragraph[index + 1].normalized if index + 1 < len(paragraph) else ""
        if token in {"aged", "age", "married", "single", "widowed", "filipino"}:
            stop = index
            break
        if token.isdigit() and next_token in {"year", "years", "yr", "yrs"}:
            stop = index
            break
        if token == "is" and any(
            word.normalized in {"resident", "residing"}
            for word in paragraph[index + 1 : min(len(paragraph), index + 5)]
        ):
            stop = index
            break
    selected = tuple(paragraph[start:stop])
    return selected if selected else None


def _issuing_barangay_candidates(
    words: Sequence[PositionalWord],
    title: Sequence[PositionalWord],
) -> list[tuple[PositionalWord, ...]]:
    title_top = min(word.top for word in title)
    lines: dict[tuple[int, int, int], list[PositionalWord]] = {}
    for word in words:
        if word.bottom >= title_top:
            continue
        lines.setdefault((word.block, word.paragraph, word.line), []).append(word)

    candidates: dict[tuple[str, ...], tuple[PositionalWord, ...]] = {}
    excluded = {"punong", "hotline", "hall", "telephone", "tel", "office"}
    locality_stops = {"marilao", "bulacan", "province", "municipality"}
    for line_words in lines.values():
        line = tuple(sorted(line_words, key=lambda word: word.left))
        tokens = [word.normalized for word in line]
        if "barangay" not in tokens or excluded.intersection(tokens):
            continue
        index = tokens.index("barangay") + 1
        if index < len(line) and line[index].normalized in {"ng", "of"}:
            index += 1
        selected: list[PositionalWord] = []
        for word in line[index:]:
            if word.normalized in locality_stops:
                break
            selected.append(word)
        normalized = tuple(word.normalized for word in selected if word.normalized)
        if normalized:
            candidates.setdefault(normalized, tuple(selected))
    return list(candidates.values())


def _date_candidates(paragraphs: Sequence[Sequence[PositionalWord]]) -> list[tuple[str, tuple[PositionalWord, ...]]]:
    candidates: list[tuple[str, tuple[PositionalWord, ...]]] = []
    for paragraph in paragraphs:
        for anchor in DATE_ANCHORS:
            matches = _find_phrase(paragraph, anchor)
            for match in matches:
                start = match + len(anchor)
                stop = len(paragraph)
                for index in range(start, len(paragraph)):
                    if paragraph[index].normalized in {"at", "in"}:
                        stop = index
                        break
                    if paragraph[index].text.rstrip().endswith("."):
                        stop = index + 1
                        break
                selected = tuple(paragraph[start:stop])
                if selected:
                    candidates.append((" ".join(anchor), selected))
    return candidates


MONTHS = {
    name.lower(): index
    for index, name in enumerate(
        (
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ),
        start=1,
    )
}


def _valid_visible_date(text: str) -> bool:
    normalized = _normalize_field_text(text)
    patterns = (
        re.compile(
            r"\b(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:\s+day\s+of)?\s+"
            r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)"
            r"[\s,]+(?P<year>\d{4})\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)"
            r"\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?[\s,]+(?P<year>\d{4})\b",
            re.IGNORECASE,
        ),
    )
    for pattern in patterns:
        match = pattern.search(normalized)
        if not match:
            continue
        try:
            date(
                int(match.group("year")),
                MONTHS[match.group("month").lower()],
                int(match.group("day")),
            )
            return True
        except (KeyError, ValueError):
            return False
    return False


def _sanitize_positional_date_token(value: Any) -> str:
    text = "" if value is None else str(value)
    start = 0
    stop = len(text)
    while start < stop and not text[start].isalnum():
        start += 1
    while stop > start and not text[stop - 1].isalnum():
        stop -= 1
    return text[start:stop]


def _read_field(
    name: str,
    words: Sequence[PositionalWord] | None,
    anchor: str,
    source_image: np.ndarray,
    variant: str,
    reader: FieldReader,
    config: IndigencyExtractionConfig,
) -> IndigencyFieldResult:
    issue_code = {
        "certificate_subject_name": "CERTIFICATE_SUBJECT_NOT_EXTRACTED",
        "issue_date": "ISSUE_DATE_NOT_EXTRACTED",
        "issuing_barangay": "ISSUING_BARANGAY_NOT_EXTRACTED",
    }[name]
    if not words:
        return _empty_field(name, variant, issue_code)
    bounds = _bounds(words, source_image.shape)
    positional_text = _normalize_field_text(
        " ".join(word.text for word in words)
    )
    if positional_text:
        return IndigencyFieldResult(
            name=name,
            raw_text=positional_text,
            success=True,
            review_required=True,
            issue_codes=(),
            detection_variant=variant,
            anchor=anchor,
            normalized_bounds=_normalized_bounds(bounds, source_image.shape),
        )
    crop = _crop(source_image, bounds, config.crop_padding_pixels)
    if crop.size == 0:
        return _empty_field(name, variant, issue_code)
    try:
        raw_text = _normalize_field_text(reader(crop.copy(), name))
    except Exception:
        raw_text = ""
    if not raw_text or (name == "issue_date" and not _valid_visible_date(raw_text)):
        return _empty_field(name, variant, issue_code)
    return IndigencyFieldResult(
        name=name,
        raw_text=raw_text,
        success=True,
        review_required=True,
        issue_codes=(),
        detection_variant=variant,
        anchor=anchor,
        normalized_bounds=_normalized_bounds(bounds, source_image.shape),
    )


def _read_date_field(
    words: Sequence[PositionalWord] | None,
    anchor: str,
    source_image: np.ndarray,
    variant: str,
    reader: FieldReader,
    config: IndigencyExtractionConfig,
) -> IndigencyFieldResult:
    if not words:
        return _empty_field("issue_date", variant, "ISSUE_DATE_NOT_EXTRACTED")

    ordered_words = tuple(sorted(words, key=lambda word: word.order))
    bounds = _bounds(ordered_words, source_image.shape)
    positional_text = " ".join(
        token
        for token in (
            _sanitize_positional_date_token(word.text)
            for word in ordered_words
        )
        if token
    )
    if _valid_visible_date(positional_text):
        raw_text = positional_text
    else:
        crop = _crop(source_image, bounds, config.crop_padding_pixels)
        if crop.size == 0:
            return _empty_field(
                "issue_date",
                variant,
                "ISSUE_DATE_NOT_EXTRACTED",
            )
        try:
            raw_text = _normalize_field_text(reader(crop.copy(), "issue_date"))
        except Exception:
            raw_text = ""
        if not _valid_visible_date(raw_text):
            return _empty_field(
                "issue_date",
                variant,
                "ISSUE_DATE_NOT_EXTRACTED",
            )

    return IndigencyFieldResult(
        name="issue_date",
        raw_text=raw_text,
        success=True,
        review_required=True,
        issue_codes=(),
        detection_variant=variant,
        anchor=anchor,
        normalized_bounds=_normalized_bounds(bounds, source_image.shape),
    )


def _barangay_diagnostics(
    *,
    candidate_found: bool,
    candidate_count: int,
    candidate_token_count: int,
    candidate_word_confidences: tuple[float, ...],
    candidate_horizontal_gaps: tuple[int, ...],
    candidate_gap_ratios: tuple[float, ...],
    candidate_word_count_before_filter: int,
    candidate_word_count_after_filter: int,
    token_filter_status: str,
    removed_token_count: int,
    candidate_source: str,
    anchor_found: bool,
    bounds_present: bool,
    crop_attempted: bool,
    crop_returned_text: bool,
    value_source: str,
    positional_validation_status: str,
    crop_validation_status: str,
    failure_stage: str,
) -> IndigencyFieldDiagnostics:
    return IndigencyFieldDiagnostics(
        candidate_found=candidate_found,
        candidate_count=candidate_count,
        candidate_token_count=candidate_token_count,
        candidate_word_confidences=candidate_word_confidences,
        candidate_horizontal_gaps=candidate_horizontal_gaps,
        candidate_gap_ratios=candidate_gap_ratios,
        candidate_word_count_before_filter=candidate_word_count_before_filter,
        candidate_word_count_after_filter=candidate_word_count_after_filter,
        token_filter_status=token_filter_status,
        removed_token_count=removed_token_count,
        candidate_source=candidate_source,
        anchor_found=anchor_found,
        bounds_present=bounds_present,
        crop_attempted=crop_attempted,
        crop_returned_text=crop_returned_text,
        value_source=value_source,
        positional_validation_status=positional_validation_status,
        crop_validation_status=crop_validation_status,
        failure_stage=failure_stage,
    )


def _normalize_barangay_value(value: Any) -> tuple[str, bool]:
    text = "" if value is None else str(value)
    contains_control = any(
        unicodedata.category(character) == "Cc" for character in text
    )
    tokens = (
        _sanitize_positional_date_token(token)
        for token in text.split()
    )
    normalized = _normalize_field_text(" ".join(token for token in tokens if token))
    return normalized, contains_control


def _barangay_word_metrics(
    words: Sequence[PositionalWord],
) -> tuple[tuple[float, ...], tuple[int, ...], tuple[float, ...]]:
    ordered = tuple(sorted(words, key=lambda word: word.left))
    confidences = tuple(round(float(word.confidence), 3) for word in ordered)
    gaps = tuple(
        int(current.left - previous.right)
        for previous, current in zip(ordered, ordered[1:])
    )
    gap_ratios = tuple(
        round(gap / max(previous.height, current.height, 1), 3)
        for gap, (previous, current) in zip(
            gaps,
            zip(ordered, ordered[1:]),
        )
    )
    return confidences, gaps, gap_ratios


def _filter_detached_barangay_noise(
    words: Sequence[PositionalWord],
    config: IndigencyExtractionConfig,
) -> tuple[tuple[PositionalWord, ...], str, int]:
    ordered = tuple(sorted(words, key=lambda word: word.left))
    if len(ordered) < 2:
        return ordered, "unchanged", 0

    previous = ordered[-2]
    trailing = ordered[-1]
    gap = trailing.left - previous.right
    gap_ratio = gap / max(previous.height, trailing.height, 1)
    low_confidence = (
        trailing.confidence < config.maximum_trailing_noise_confidence
    )
    detached = gap_ratio > config.minimum_detached_gap_ratio
    strong_predecessor = (
        previous.confidence >= config.minimum_leading_word_confidence
    )
    sufficient_confidence_drop = (
        previous.confidence - trailing.confidence
        >= config.minimum_confidence_drop
    )
    removal_allowed = config.maximum_detached_tokens_removed >= 1

    if (
        low_confidence
        and detached
        and strong_predecessor
        and sufficient_confidence_drop
        and removal_allowed
    ):
        return ordered[:-1], "detached_low_confidence_removed", 1

    all_words_strong = all(
        word.confidence >= config.minimum_leading_word_confidence
        for word in ordered
    )
    all_gaps_connected = all(
        (current.left - previous.right)
        / max(previous.height, current.height, 1)
        <= config.minimum_detached_gap_ratio
        for previous, current in zip(ordered, ordered[1:])
    )
    if all_words_strong and all_gaps_connected:
        return ordered, "unchanged", 0
    return ordered, "unsafe_to_filter", 0


def _valid_barangay_value(
    value: str,
    *,
    contains_control: bool,
    maximum_length: int,
) -> bool:
    return (
        1 <= len(value) <= maximum_length
        and not contains_control
        and any(character.isalpha() for character in value)
        and value.casefold() != "barangay"
    )


def _subject_evidence(
    screening_pass: ScreeningPass,
) -> tuple[FieldEvidence | None, bool]:
    paragraphs = _subject_paragraphs(_group_paragraphs(screening_pass.words))
    if len(paragraphs) != 1:
        return None, len(paragraphs) > 1
    selected = _subject_words(paragraphs[0])
    if not selected:
        return None, False
    value = _normalize_field_text(" ".join(word.text for word in selected))
    return (
        FieldEvidence(
            screening_pass=screening_pass,
            words=selected,
            anchor="this is to certify that",
            comparison_value=_comparison_key(value),
            positional_value_valid=bool(value),
        ),
        False,
    )


def _date_evidence(
    screening_pass: ScreeningPass,
) -> tuple[FieldEvidence | None, bool]:
    candidates = _date_candidates(_group_paragraphs(screening_pass.words))
    if len(candidates) != 1:
        return None, len(candidates) > 1
    anchor, selected = candidates[0]
    ordered = tuple(sorted(selected, key=lambda word: word.order))
    value = " ".join(
        token
        for token in (
            _sanitize_positional_date_token(word.text)
            for word in ordered
        )
        if token
    )
    return (
        FieldEvidence(
            screening_pass=screening_pass,
            words=ordered,
            anchor=anchor,
            comparison_value=_comparison_key(value),
            positional_value_valid=_valid_visible_date(value),
        ),
        False,
    )


def _barangay_evidence(
    screening_pass: ScreeningPass,
    config: IndigencyExtractionConfig,
) -> tuple[FieldEvidence | None, bool]:
    title = _title_candidate(
        screening_pass.words,
        screening_pass.screen_shape[0],
        config.title_maximum_y,
    )
    if title is None:
        return None, False
    candidates = _issuing_barangay_candidates(screening_pass.words, title)
    if len(candidates) != 1:
        return None, len(candidates) > 1
    selected = tuple(candidates[0])
    filtered, filter_status, _removed = _filter_detached_barangay_noise(
        selected,
        config,
    )
    value, contains_control = _normalize_barangay_value(
        " ".join(word.text for word in filtered)
    )
    valid = (
        filter_status != "unsafe_to_filter"
        and _valid_barangay_value(
            value,
            contains_control=contains_control,
            maximum_length=config.maximum_barangay_length,
        )
    )
    return (
        FieldEvidence(
            screening_pass=screening_pass,
            words=selected,
            anchor=" ".join(word.text for word in selected),
            comparison_value=_comparison_key(value),
            positional_value_valid=valid,
        ),
        False,
    )


def _select_field_evidence(
    evidence: Sequence[FieldEvidence],
    *,
    ambiguous_in_pass: bool,
) -> tuple[FieldEvidence | None, bool]:
    if ambiguous_in_pass or not evidence:
        return None, False

    valid = [item for item in evidence if item.positional_value_valid]
    compared = valid if valid else list(evidence)
    values = {
        item.comparison_value
        for item in compared
        if item.comparison_value
    }
    if len(values) > 1:
        return None, True
    if valid:
        return valid[0], False
    if compared and len(values) <= 1:
        return compared[0], False
    return None, False


def _read_issuing_barangay_field(
    candidates: Sequence[Sequence[PositionalWord]],
    source_image: np.ndarray,
    variant: str,
    reader: FieldReader,
    config: IndigencyExtractionConfig,
) -> IndigencyFieldResult:
    candidate_count = len(candidates)
    if candidate_count != 1:
        diagnostics = _barangay_diagnostics(
            candidate_found=candidate_count > 0,
            candidate_count=candidate_count,
            candidate_token_count=0,
            candidate_word_confidences=(),
            candidate_horizontal_gaps=(),
            candidate_gap_ratios=(),
            candidate_word_count_before_filter=0,
            candidate_word_count_after_filter=0,
            token_filter_status="not_attempted",
            removed_token_count=0,
            candidate_source="ambiguous" if candidate_count > 1 else "none",
            anchor_found=candidate_count > 0,
            bounds_present=False,
            crop_attempted=False,
            crop_returned_text=False,
            value_source="none",
            positional_validation_status="not_attempted",
            crop_validation_status="not_attempted",
            failure_stage="candidate_selection",
        )
        return IndigencyFieldResult(
            name="issuing_barangay",
            raw_text="",
            success=False,
            review_required=True,
            issue_codes=("ISSUING_BARANGAY_NOT_EXTRACTED",),
            detection_variant=variant,
            anchor="",
            normalized_bounds=None,
            diagnostics=diagnostics,
        )

    selected = tuple(candidates[0])
    anchor = " ".join(word.text for word in selected)
    bounds = _bounds(selected, source_image.shape)
    normalized_bounds = _normalized_bounds(bounds, source_image.shape)
    candidate_word_confidences, candidate_horizontal_gaps, candidate_gap_ratios = (
        _barangay_word_metrics(selected)
    )
    filtered_words, token_filter_status, removed_token_count = (
        _filter_detached_barangay_noise(selected, config)
    )
    candidate_word_count_before_filter = len(selected)
    candidate_word_count_after_filter = sum(
        bool(_sanitize_positional_date_token(word.text)) for word in filtered_words
    )
    base_diagnostics = {
        "candidate_found": True,
        "candidate_count": 1,
        "candidate_token_count": len(selected),
        "candidate_word_confidences": candidate_word_confidences,
        "candidate_horizontal_gaps": candidate_horizontal_gaps,
        "candidate_gap_ratios": candidate_gap_ratios,
        "candidate_word_count_before_filter": candidate_word_count_before_filter,
        "candidate_word_count_after_filter": candidate_word_count_after_filter,
        "token_filter_status": token_filter_status,
        "removed_token_count": removed_token_count,
        "candidate_source": "pre_title_header",
        "anchor_found": True,
        "bounds_present": True,
    }
    positional_text, positional_has_control = _normalize_barangay_value(
        " ".join(word.text for word in filtered_words)
    )
    if token_filter_status != "unsafe_to_filter" and _valid_barangay_value(
        positional_text,
        contains_control=positional_has_control,
        maximum_length=config.maximum_barangay_length,
    ):
        diagnostics = _barangay_diagnostics(
            **base_diagnostics,
            crop_attempted=False,
            crop_returned_text=False,
            value_source="positional",
            positional_validation_status="valid",
            crop_validation_status="not_attempted",
            failure_stage="none",
        )
        return IndigencyFieldResult(
            name="issuing_barangay",
            raw_text=positional_text,
            success=True,
            review_required=True,
            issue_codes=(),
            detection_variant=variant,
            anchor=anchor,
            normalized_bounds=normalized_bounds,
            diagnostics=diagnostics,
        )

    crop = _crop(source_image, bounds, config.crop_padding_pixels)
    if crop.size == 0:
        diagnostics = _barangay_diagnostics(
            **base_diagnostics,
            crop_attempted=False,
            crop_returned_text=False,
            value_source="none",
            positional_validation_status="invalid",
            crop_validation_status="not_attempted",
            failure_stage="crop_generation",
        )
        return IndigencyFieldResult(
            name="issuing_barangay",
            raw_text="",
            success=False,
            review_required=True,
            issue_codes=("ISSUING_BARANGAY_NOT_EXTRACTED",),
            detection_variant=variant,
            anchor=anchor,
            normalized_bounds=normalized_bounds,
            diagnostics=diagnostics,
        )

    try:
        crop_result = reader(crop.copy(), "issuing_barangay")
    except Exception:
        diagnostics = _barangay_diagnostics(
            **base_diagnostics,
            crop_attempted=True,
            crop_returned_text=False,
            value_source="none",
            positional_validation_status="invalid",
            crop_validation_status="exception",
            failure_stage="crop_ocr",
        )
        return IndigencyFieldResult(
            name="issuing_barangay",
            raw_text="",
            success=False,
            review_required=True,
            issue_codes=("ISSUING_BARANGAY_NOT_EXTRACTED",),
            detection_variant=variant,
            anchor=anchor,
            normalized_bounds=normalized_bounds,
            diagnostics=diagnostics,
        )

    crop_returned_text = bool(_normalize_field_text(crop_result))
    crop_text, crop_has_control = _normalize_barangay_value(crop_result)
    if not crop_text:
        diagnostics = _barangay_diagnostics(
            **base_diagnostics,
            crop_attempted=True,
            crop_returned_text=crop_returned_text,
            value_source="none",
            positional_validation_status="invalid",
            crop_validation_status="empty",
            failure_stage="crop_ocr",
        )
        return IndigencyFieldResult(
            name="issuing_barangay",
            raw_text="",
            success=False,
            review_required=True,
            issue_codes=("ISSUING_BARANGAY_NOT_EXTRACTED",),
            detection_variant=variant,
            anchor=anchor,
            normalized_bounds=normalized_bounds,
            diagnostics=diagnostics,
        )

    if not _valid_barangay_value(
        crop_text,
        contains_control=crop_has_control,
        maximum_length=config.maximum_barangay_length,
    ):
        diagnostics = _barangay_diagnostics(
            **base_diagnostics,
            crop_attempted=True,
            crop_returned_text=crop_returned_text,
            value_source="none",
            positional_validation_status="invalid",
            crop_validation_status="invalid",
            failure_stage="crop_ocr",
        )
        return IndigencyFieldResult(
            name="issuing_barangay",
            raw_text="",
            success=False,
            review_required=True,
            issue_codes=("ISSUING_BARANGAY_NOT_EXTRACTED",),
            detection_variant=variant,
            anchor=anchor,
            normalized_bounds=normalized_bounds,
            diagnostics=diagnostics,
        )

    diagnostics = _barangay_diagnostics(
        **base_diagnostics,
        crop_attempted=True,
        crop_returned_text=True,
        value_source="crop_ocr",
        positional_validation_status="invalid",
        crop_validation_status="valid",
        failure_stage="none",
    )
    return IndigencyFieldResult(
        name="issuing_barangay",
        raw_text=crop_text,
        success=True,
        review_required=True,
        issue_codes=(),
        detection_variant=variant,
        anchor=anchor,
        normalized_bounds=normalized_bounds,
        diagnostics=diagnostics,
    )


def extract_indigency_core_fields(
    image: Any,
    word_reader: WordReader | None = None,
    field_reader: FieldReader | None = None,
    config: IndigencyExtractionConfig | None = None,
) -> StageResult[IndigencyExtractionOutput]:
    extraction_started = time.monotonic()
    resolved = config or IndigencyExtractionConfig()
    try:
        source = _validate_image(image)
    except (OCRInputError, TypeError, ValueError):
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=None,
            issues=[_issue("INDIGENCY_WORD_DATA_UNAVAILABLE")],
            metrics={"manual_review_required": True},
        )

    deadline = extraction_started + resolved.total_request_timeout_seconds
    screening_deadline = min(
        deadline,
        extraction_started + resolved.screening_budget_seconds,
    )
    field_crop_deadline = deadline

    orientation_screen_seconds = 0.0
    whole_page_ocr_seconds = 0.0
    field_crop_ocr_seconds = 0.0
    timeout_count = 0
    candidate_count = 0
    crop_ocr_attempt_count = 0
    otsu_used = False
    screening_timeout_occurred = False
    screening_budget_exhausted = False
    psm11_attempt_count = 0
    psm6_attempt_count = 0
    evidence_fusion_used = False
    field_source_conflict_count = 0
    fused_orientation = "none"

    def performance_metrics(**extra: Any) -> dict[str, Any]:
        return {
            "orientation_screen_seconds": round(
                orientation_screen_seconds,
                6,
            ),
            "whole_page_ocr_seconds": round(
                whole_page_ocr_seconds,
                6,
            ),
            "field_crop_ocr_seconds": round(
                field_crop_ocr_seconds,
                6,
            ),
            "total_structured_extraction_seconds": round(
                time.monotonic() - extraction_started,
                6,
            ),
            "candidate_attempt_count": candidate_count,
            "candidate_count": candidate_count,
            "screen_ocr_attempt_count": candidate_count,
            "crop_ocr_attempt_count": crop_ocr_attempt_count,
            "timeout_count": timeout_count,
            "otsu_used": otsu_used,
            "psm11_attempt_count": psm11_attempt_count,
            "psm6_attempt_count": psm6_attempt_count,
            "evidence_fusion_used": evidence_fusion_used,
            "fused_orientation": fused_orientation,
            "field_source_conflict_count": field_source_conflict_count,
            "screening_budget_exhausted": screening_budget_exhausted,
            "bounded_attempts_exhausted": (
                candidate_count >= resolved.maximum_candidate_attempts
            ),
            "full_resolution_whole_page_ocr_used": False,
            "exhaustive_fallback_used": False,
            "screening_budget_seconds": resolved.screening_budget_seconds,
            "field_crop_budget_seconds": resolved.field_crop_budget_seconds,
            "internal_request_budget_seconds": (
                resolved.total_request_timeout_seconds
            ),
            "external_hard_timeout_seconds": (
                resolved.external_hard_timeout_seconds
            ),
            **extra,
        }

    def read_screen_words(
        detection_image: np.ndarray,
        variant: str,
        page_segmentation_mode: int,
    ) -> Mapping[str, Sequence[Any]]:
        remaining = min(
            resolved.screen_timeout_seconds,
            screening_deadline - time.monotonic(),
            deadline - time.monotonic(),
        )
        if remaining <= 0.1:
            raise RuntimeError("screening time budget exhausted")

        screen_config = replace(
            resolved,
            page_segmentation_mode=page_segmentation_mode,
            screen_timeout_seconds=max(0.1, remaining),
        )
        if word_reader is None:
            return _default_word_reader(
                detection_image,
                variant,
                screen_config,
            )
        return word_reader(
            detection_image,
            variant,
            screen_config,
        )

    def base_ocr_reader(crop: np.ndarray, name: str) -> Any:
        remaining = min(
            resolved.crop_timeout_seconds,
            field_crop_deadline - time.monotonic(),
            deadline - time.monotonic(),
        )
        if remaining <= 0.1:
            raise RuntimeError("field crop time budget exhausted")
        if field_reader is None:
            return _default_field_reader(
                crop,
                name,
                resolved,
                remaining,
            )
        return field_reader(crop, name)

    def timed_field_reader(crop: np.ndarray, name: str) -> Any:
        nonlocal crop_ocr_attempt_count
        nonlocal field_crop_ocr_seconds
        nonlocal timeout_count

        now = time.monotonic()
        if now >= deadline or now >= field_crop_deadline:
            timeout_count += 1
            raise RuntimeError("structured extraction time budget exhausted")

        crop_ocr_attempt_count += 1
        started = time.monotonic()
        try:
            return base_ocr_reader(crop, name)
        except RuntimeError as exc:
            message = str(exc).casefold()
            if (
                "timeout" in message
                or "time budget" in message
                or time.monotonic() >= deadline
                or time.monotonic() >= field_crop_deadline
            ):
                timeout_count += 1
            raise
        finally:
            field_crop_ocr_seconds += time.monotonic() - started

    primary_screen_source = _resize_for_screening(
        source,
        resolved.screening_maximum_dimension,
    )
    fallback_screen_source = _resize_for_screening(
        source,
        resolved.fallback_screening_maximum_dimension,
    )
    candidates: list[ScreeningPass] = []

    def screen_orientation(
        orientation: str,
        variant: str,
        page_segmentation_mode: int,
        source_image: np.ndarray | None = None,
    ) -> ScreeningPass | None:
        nonlocal candidate_count
        nonlocal orientation_screen_seconds
        nonlocal whole_page_ocr_seconds
        nonlocal timeout_count
        nonlocal otsu_used
        nonlocal psm11_attempt_count
        nonlocal psm6_attempt_count
        nonlocal screening_timeout_occurred
        nonlocal screening_budget_exhausted

        now = time.monotonic()
        if candidate_count >= resolved.maximum_candidate_attempts:
            return None
        if now >= deadline or now >= screening_deadline:
            screening_budget_exhausted = True
            return None

        selected_source = (
            primary_screen_source
            if source_image is None
            else source_image
        )
        oriented_screen = _oriented_image(selected_source, orientation)
        gray = _grayscale(oriented_screen)
        if variant == "grayscale":
            detection_image = gray
        elif variant == "otsu_threshold":
            otsu_used = True
            _, detection_image = cv2.threshold(
                gray,
                0,
                255,
                cv2.THRESH_BINARY + cv2.THRESH_OTSU,
            )
        else:
            raise ValueError("unsupported screening variant")

        candidate_count += 1
        if page_segmentation_mode == resolved.screen_page_segmentation_mode:
            psm11_attempt_count += 1
        elif page_segmentation_mode == resolved.page_segmentation_mode:
            psm6_attempt_count += 1
        started = time.monotonic()
        try:
            words = _parse_words(
                read_screen_words(
                    detection_image.copy(),
                    variant,
                    page_segmentation_mode,
                ),
                resolved,
            )
        except (
            pytesseract.TesseractNotFoundError,
            OCRBinaryUnavailableError,
            OCRExecutionError,
            ValueError,
            TypeError,
            KeyError,
            IndexError,
        ) as exc:
            message = str(exc).casefold()
            if "timeout" in message or "time budget" in message:
                timeout_count += 1
                screening_timeout_occurred = True
            return None
        except RuntimeError as exc:
            message = str(exc).casefold()
            if (
                "timeout" in message
                or "time budget" in message
                or time.monotonic() >= screening_deadline
            ):
                timeout_count += 1
                screening_timeout_occurred = True
            return None
        except Exception as exc:
            message = str(exc).casefold()
            if "timeout" in message or "time budget" in message:
                timeout_count += 1
                screening_timeout_occurred = True
            return None
        finally:
            duration = time.monotonic() - started
            orientation_screen_seconds += duration
            whole_page_ocr_seconds += duration
            if time.monotonic() >= screening_deadline:
                screening_budget_exhausted = True

        candidate = ScreeningPass(
            orientation=orientation,
            page_segmentation_mode=page_segmentation_mode,
            variant=variant,
            words=words,
            score=_variant_score(
                words,
                oriented_screen.shape[0],
                resolved,
            ),
            screen_shape=oriented_screen.shape,
        )
        candidates.append(candidate)
        return candidate

    selected_processing_path = "original_same_orientation_fusion"
    original_psm11 = screen_orientation(
        "original",
        "grayscale",
        resolved.screen_page_segmentation_mode,
    )
    original_psm6 = screen_orientation(
        "original",
        "grayscale",
        resolved.page_segmentation_mode,
    )
    original_passes = [
        item
        for item in (original_psm11, original_psm6)
        if item is not None
    ]
    selected_orientation = "original"
    selected_passes = original_passes

    if _complete_fused_evidence(original_passes, resolved):
        evidence_fusion_used = not any(
            _complete_structural_evidence(item.score, resolved)
            for item in original_passes
        )
        fused_orientation = "original"
    else:
        rotated_psm11: list[ScreeningPass] = []
        for orientation in (
            "clockwise_90",
            "counterclockwise_90",
            "180",
        ):
            candidate = screen_orientation(
                orientation,
                "grayscale",
                resolved.screen_page_segmentation_mode,
            )
            if candidate is not None:
                rotated_psm11.append(candidate)

        orientation_psm11 = [
            item
            for item in (original_psm11, *rotated_psm11)
            if item is not None
        ]
        meaningful = [
            item
            for item in orientation_psm11
            if _meaningful_structural_evidence(item, resolved)
        ]
        if meaningful:
            strongest_rank = max(_structural_rank(item) for item in meaningful)
            strongest = [
                item
                for item in meaningful
                if _structural_rank(item) == strongest_rank
            ]
        else:
            strongest = []

        if len(strongest) != 1:
            timed_out = (
                screening_timeout_occurred
                or screening_budget_exhausted
                or time.monotonic() >= deadline
            )
            issue_code = (
                "INDIGENCY_PROCESSING_TIMEOUT"
                if timed_out
                else (
                    "INDIGENCY_WORD_DATA_UNAVAILABLE"
                    if not candidates
                    else (
                        "INDIGENCY_ORIENTATION_AMBIGUOUS"
                        if len(strongest) > 1
                        else "INDIGENCY_DOCUMENT_NOT_DETECTED"
                    )
                )
            )
            return StageResult(
                stage=STAGE_NAME,
                success=False,
                status="review_required",
                data=None,
                issues=[
                    _issue(issue_code),
                    _issue("INDIGENCY_MANUAL_REVIEW_REQUIRED"),
                ],
                metrics=performance_metrics(
                    manual_review_required=True,
                    selected_processing_path="bounded_screening_unresolved",
                ),
            )

        selected_psm11 = strongest[0]
        selected_orientation = selected_psm11.orientation
        selected_psm6 = (
            original_psm6
            if selected_orientation == "original"
            else screen_orientation(
                selected_orientation,
                "grayscale",
                resolved.page_segmentation_mode,
                source_image=fallback_screen_source,
            )
        )
        selected_passes = [
            item
            for item in (selected_psm11, selected_psm6)
            if item is not None
        ]
        selected_processing_path = "rotated_same_orientation_fusion"

        if not _complete_fused_evidence(selected_passes, resolved):
            fused_score = _fused_structural_score(selected_passes)
            missing_title_or_subject = not fused_score[0] or not fused_score[1]
            otsu_psm = (
                resolved.screen_page_segmentation_mode
                if missing_title_or_subject
                else resolved.page_segmentation_mode
            )
            otsu_pass = screen_orientation(
                selected_orientation,
                "otsu_threshold",
                otsu_psm,
                source_image=fallback_screen_source,
            )
            if otsu_pass is not None:
                selected_passes.append(otsu_pass)
            selected_processing_path = "rotated_fusion_with_otsu"

        if not _complete_fused_evidence(selected_passes, resolved):
            timed_out = (
                screening_timeout_occurred
                or screening_budget_exhausted
                or time.monotonic() >= deadline
            )
            return StageResult(
                stage=STAGE_NAME,
                success=False,
                status="review_required",
                data=None,
                issues=[
                    _issue(
                        "INDIGENCY_PROCESSING_TIMEOUT"
                        if timed_out
                        else "INDIGENCY_DOCUMENT_NOT_DETECTED"
                    ),
                    _issue("INDIGENCY_MANUAL_REVIEW_REQUIRED"),
                ],
                metrics=performance_metrics(
                    manual_review_required=True,
                    selected_processing_path="bounded_screening_unresolved",
                ),
            )

        evidence_fusion_used = not any(
            _complete_structural_evidence(item.score, resolved)
            for item in selected_passes
        )
        fused_orientation = selected_orientation

    if not candidates:
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=None,
            issues=[_issue("INDIGENCY_WORD_DATA_UNAVAILABLE")],
            metrics=performance_metrics(
                manual_review_required=True,
                selected_processing_path="word_data_unavailable",
            ),
        )

    oriented_source = _oriented_image(
        source,
        selected_orientation,
    )
    selected_screen_source = _oriented_image(
        (
            primary_screen_source
            if selected_orientation == "original"
            else fallback_screen_source
        ),
        selected_orientation,
    )
    angle = _estimate_deskew_angle(
        selected_screen_source,
        resolved.maximum_deskew_degrees,
    )
    transformed_source = oriented_source

    field_crop_deadline = min(
        deadline,
        time.monotonic() + resolved.field_crop_budget_seconds,
    )

    issues: list[dict[str, str]] = []
    title_sources = [
        item
        for item in selected_passes
        if _title_candidate(
            item.words,
            item.screen_shape[0],
            resolved.title_maximum_y,
        )
        is not None
    ]
    title_source = title_sources[0]
    title_screen_words = _title_candidate(
        title_source.words,
        title_source.screen_shape[0],
        resolved.title_maximum_y,
    )
    title = _map_words_to_image(
        title_screen_words or (),
        title_source.screen_shape,
        transformed_source.shape,
    )

    subject_evidence: list[FieldEvidence] = []
    date_evidence: list[FieldEvidence] = []
    barangay_evidence: list[FieldEvidence] = []
    subject_ambiguous = False
    date_ambiguous = False
    barangay_ambiguous = False
    for screening_pass in selected_passes:
        item, ambiguous = _subject_evidence(screening_pass)
        subject_ambiguous = subject_ambiguous or ambiguous
        if item is not None:
            subject_evidence.append(item)

        item, ambiguous = _date_evidence(screening_pass)
        date_ambiguous = date_ambiguous or ambiguous
        if item is not None:
            date_evidence.append(item)

        item, ambiguous = _barangay_evidence(screening_pass, resolved)
        barangay_ambiguous = barangay_ambiguous or ambiguous
        if item is not None:
            barangay_evidence.append(item)

    subject_source, subject_conflict = _select_field_evidence(
        subject_evidence,
        ambiguous_in_pass=subject_ambiguous,
    )
    date_source, date_conflict = _select_field_evidence(
        date_evidence,
        ambiguous_in_pass=date_ambiguous,
    )
    barangay_source, barangay_conflict = _select_field_evidence(
        barangay_evidence,
        ambiguous_in_pass=barangay_ambiguous,
    )
    field_source_conflict_count = sum(
        (subject_conflict, date_conflict, barangay_conflict)
    )

    def mapped_evidence(
        evidence: FieldEvidence | None,
    ) -> tuple[tuple[PositionalWord, ...] | None, str, str]:
        if evidence is None:
            return None, "", "fused_unresolved"
        return (
            _map_words_to_image(
                evidence.words,
                evidence.screening_pass.screen_shape,
                transformed_source.shape,
            ),
            evidence.anchor,
            evidence.screening_pass.source_name,
        )

    subject_selection, subject_anchor, subject_variant = mapped_evidence(
        subject_source
    )
    date_selection, date_anchor, date_variant = mapped_evidence(date_source)
    barangay_selection, _barangay_anchor, barangay_variant = mapped_evidence(
        barangay_source
    )

    if subject_conflict or subject_ambiguous:
        subject_field = _empty_field(
            "certificate_subject_name",
            "fused_conflict",
            "CERTIFICATE_SUBJECT_NOT_EXTRACTED",
            *(("FIELD_SOURCE_CONFLICT",) if subject_conflict else ()),
        )
    else:
        subject_field = _read_field(
            "certificate_subject_name",
            subject_selection,
            subject_anchor,
            transformed_source,
            subject_variant,
            timed_field_reader,
            resolved,
        )

    if date_conflict or date_ambiguous:
        date_field = _empty_field(
            "issue_date",
            "fused_conflict",
            "ISSUE_DATE_NOT_EXTRACTED",
            *(("FIELD_SOURCE_CONFLICT",) if date_conflict else ()),
        )
    else:
        date_field = _read_date_field(
            date_selection,
            date_anchor,
            transformed_source,
            date_variant,
            timed_field_reader,
            resolved,
        )

    if barangay_ambiguous:
        ambiguous_pass = next(
            item
            for item in selected_passes
            if (
                (
                    pass_title := _title_candidate(
                        item.words,
                        item.screen_shape[0],
                        resolved.title_maximum_y,
                    )
                )
                is not None
                and len(
                    _issuing_barangay_candidates(item.words, pass_title)
                )
                > 1
            )
        )
        ambiguous_title = _title_candidate(
            ambiguous_pass.words,
            ambiguous_pass.screen_shape[0],
            resolved.title_maximum_y,
        )
        ambiguous_candidates = [
            _map_words_to_image(
                candidate,
                ambiguous_pass.screen_shape,
                transformed_source.shape,
            )
            for candidate in _issuing_barangay_candidates(
                ambiguous_pass.words,
                ambiguous_title or (),
            )
        ]
        barangay_field = _read_issuing_barangay_field(
            ambiguous_candidates,
            transformed_source,
            ambiguous_pass.source_name,
            timed_field_reader,
            resolved,
        )
    elif barangay_conflict:
        barangay_field = _empty_field(
            "issuing_barangay",
            "fused_conflict",
            "ISSUING_BARANGAY_NOT_EXTRACTED",
            "FIELD_SOURCE_CONFLICT",
        )
    else:
        barangay_field = _read_issuing_barangay_field(
            [barangay_selection] if barangay_selection else (),
            transformed_source,
            barangay_variant,
            timed_field_reader,
            resolved,
        )

    fields = (subject_field, date_field, barangay_field)
    for field_name, ambiguous in (
        ("certificate_subject_name", subject_ambiguous),
        ("issue_date", date_ambiguous),
        ("issuing_barangay", barangay_ambiguous),
    ):
        if ambiguous:
            issues.append(_issue("FIELD_ANCHOR_AMBIGUOUS", field_name))
    if not title:
        issues.append(
            _issue(
                "INDIGENCY_DOCUMENT_NOT_DETECTED",
            )
        )
    for field in fields:
        for code in field.issue_codes:
            issues.append(_issue(code, field.name))
    if abs(angle) > resolved.elevated_deskew_degrees:
        issues.append(_issue("DOCUMENT_DESKEW_ELEVATED"))
    issues.append(_issue("INDIGENCY_MANUAL_REVIEW_REQUIRED"))

    metadata = MappingProxyType(
        {
            field.name: MappingProxyType(
                {
                    "anchor": field.anchor,
                    "normalized_bounds": field.normalized_bounds,
                    "detection_variant": field.detection_variant,
                }
            )
            for field in fields
        }
    )
    # Raw snapshot selection does not influence any field or orientation decision.
    raw_text_source = max(selected_passes, key=lambda item: len(item.words))
    selected_detection_variant = "same_orientation_fusion"
    output = IndigencyExtractionOutput(
        fields=fields,
        field_count=len(fields),
        raw_text=_positional_raw_text(raw_text_source.words),
        detection_variant=selected_detection_variant,
        selected_orientation=selected_orientation,
        selected_detection_variant=selected_detection_variant,
        candidate_count=candidate_count,
        deskew_angle_degrees=float(angle),
        title_anchor=" ".join(word.text for word in title),
        anchor_metadata=metadata,
    )
    return StageResult(
        stage=STAGE_NAME,
        success=True,
        status="review_required",
        data=output,
        issues=issues,
        metrics=performance_metrics(
            field_count=len(fields),
            successful_field_count=sum(
                field.success
                for field in fields
            ),
            failed_field_count=sum(
                not field.success
                for field in fields
            ),
            word_count=max(len(item.words) for item in selected_passes),
            deskew_angle_degrees=abs(angle),
            selected_orientation=selected_orientation,
            selected_detection_variant=selected_detection_variant,
            selected_processing_path=selected_processing_path,
            manual_review_required=True,
        ),
    )
