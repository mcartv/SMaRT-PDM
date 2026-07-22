from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
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
    ocr_image,
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
    minimum_word_confidence: float = 15.0
    title_maximum_y: float = 0.45
    elevated_deskew_degrees: float = 3.0
    maximum_deskew_degrees: float = 7.0
    crop_padding_pixels: int = 4
    maximum_barangay_length: int = 80


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
    detection_variant: str
    selected_orientation: str
    selected_detection_variant: str
    candidate_count: int
    deskew_angle_degrees: float
    title_anchor: str
    anchor_metadata: Mapping[str, Mapping[str, Any]]


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
    tesseract_config = f"--oem {config.oem} --psm {config.page_segmentation_mode}"
    return pytesseract.image_to_data(
        image,
        lang=config.language,
        config=tesseract_config,
        output_type=pytesseract.Output.DICT,
    )


def _default_field_reader(image: np.ndarray, _field_name: str) -> str:
    return ocr_image(image)


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
) -> tuple[int, int, int, int]:
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
    return (
        title_present,
        subject_present,
        date_present,
        len(words),
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
    base_diagnostics = {
        "candidate_found": True,
        "candidate_count": 1,
        "candidate_token_count": len(selected),
        "candidate_source": "pre_title_header",
        "anchor_found": True,
        "bounds_present": True,
    }
    positional_text, positional_has_control = _normalize_barangay_value(
        " ".join(word.text for word in selected)
    )
    if _valid_barangay_value(
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

    detection_reader = word_reader or _default_word_reader
    ocr_reader = field_reader or _default_field_reader
    candidates: list[
        tuple[
            tuple[int, int, int, int],
            str,
            str,
            tuple[PositionalWord, ...],
            np.ndarray,
            float,
        ]
    ] = []
    candidate_count = 0
    for orientation, oriented_source in _orientation_candidates(source):
        angle = _estimate_deskew_angle(
            oriented_source,
            resolved.maximum_deskew_degrees,
        )
        transformed_candidate = _deskew(oriented_source, -angle)
        for variant, detection_image in _detection_variants(transformed_candidate):
            candidate_count += 1
            try:
                words = _parse_words(
                    detection_reader(detection_image.copy(), variant, resolved),
                    resolved,
                )
                candidates.append(
                    (
                        _variant_score(
                            words,
                            transformed_candidate.shape[0],
                            resolved,
                        ),
                        orientation,
                        variant,
                        words,
                        transformed_candidate,
                        angle,
                    )
                )
            except (
                pytesseract.TesseractNotFoundError,
                OCRBinaryUnavailableError,
                OCRExecutionError,
                ValueError,
                TypeError,
                KeyError,
                IndexError,
            ):
                continue
            except Exception:
                continue

    if not candidates:
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=None,
            issues=[_issue("INDIGENCY_WORD_DATA_UNAVAILABLE")],
            metrics={
                "manual_review_required": True,
                "candidate_count": candidate_count,
            },
        )
    (
        _,
        selected_orientation,
        variant,
        words,
        transformed_source,
        angle,
    ) = max(candidates, key=lambda candidate: candidate[0])
    title = _title_candidate(words, transformed_source.shape[0], resolved.title_maximum_y)
    if title is None:
        return StageResult(
            stage=STAGE_NAME,
            success=False,
            status="failed",
            data=None,
            issues=[_issue("INDIGENCY_DOCUMENT_NOT_DETECTED")],
            metrics={
                "manual_review_required": True,
                "word_count": len(words),
                "deskew_angle_degrees": abs(angle),
                "selected_orientation": selected_orientation,
                "selected_detection_variant": variant,
                "candidate_count": candidate_count,
            },
        )

    paragraphs = _group_paragraphs(words)
    subject_paragraphs = _subject_paragraphs(paragraphs)
    issues: list[dict[str, str]] = []
    if len(subject_paragraphs) == 1:
        subject_selection = _subject_words(subject_paragraphs[0])
    else:
        subject_selection = None
        if len(subject_paragraphs) > 1:
            issues.append(
                _issue("FIELD_ANCHOR_AMBIGUOUS", "certificate_subject_name")
            )

    barangay_candidates = _issuing_barangay_candidates(words, title)
    if len(barangay_candidates) > 1:
        issues.append(_issue("FIELD_ANCHOR_AMBIGUOUS", "issuing_barangay"))

    dates = _date_candidates(paragraphs)
    date_selection = dates[0][1] if len(dates) == 1 else None
    date_anchor = dates[0][0] if len(dates) == 1 else ""
    if len(dates) > 1:
        issues.append(_issue("FIELD_ANCHOR_AMBIGUOUS", "issue_date"))

    fields = (
        _read_field(
            "certificate_subject_name",
            subject_selection,
            "this is to certify that",
            transformed_source,
            variant,
            ocr_reader,
            resolved,
        ),
        _read_date_field(
            date_selection,
            date_anchor,
            transformed_source,
            variant,
            ocr_reader,
            resolved,
        ),
        _read_issuing_barangay_field(
            barangay_candidates,
            transformed_source,
            variant,
            ocr_reader,
            resolved,
        ),
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
    output = IndigencyExtractionOutput(
        fields=fields,
        field_count=len(fields),
        detection_variant=variant,
        selected_orientation=selected_orientation,
        selected_detection_variant=variant,
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
        metrics={
            "field_count": len(fields),
            "successful_field_count": sum(field.success for field in fields),
            "failed_field_count": sum(not field.success for field in fields),
            "word_count": len(words),
            "deskew_angle_degrees": abs(angle),
            "selected_orientation": selected_orientation,
            "selected_detection_variant": variant,
            "candidate_count": candidate_count,
            "manual_review_required": True,
        },
    )
