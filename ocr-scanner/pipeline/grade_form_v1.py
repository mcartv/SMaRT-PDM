"""Single-pass, registered Grade Form OCR using the existing preprocessing."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

import pytesseract
from pytesseract import Output

from ocr import OCR_TIMEOUT_SECONDS, fast_preprocess


@dataclass(frozen=True)
class GradeFormResult:
    matched: bool
    raw_text: str
    fields: dict[str, Any]
    field_confidence: dict[str, float | None]
    validation_issues: list[dict[str, str]]


FIELD_PATTERNS = {
    "student_number": re.compile(
        r"^\s*(?:student\s*(?:number|no\.?|id)|pdm\s*id)\s*[:\-]?\s*(.+)$", re.I
    ),
    "student_name": re.compile(r"^\s*(?:student\s*)?name\s*[:\-]?\s*(.+)$", re.I),
    "course": re.compile(r"^\s*(?:course|program)\s*[:\-]?\s*(.+)$", re.I),
    "semester": re.compile(r"^\s*semester\s*[:\-]?\s*(.+)$", re.I),
    "academic_year": re.compile(
        r"^\s*(?:academic\s*year|school\s*year|a\.?y\.?)\s*[:\-]?\s*(.+)$", re.I
    ),
    "gwa": re.compile(
        r"^\s*(?:GWA|general\s+weighted\s+average)\s*[:\-]?\s*([1-5](?:\.\d{1,2})?)\b",
        re.I,
    ),
}


def _confidence(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def _field(value: str) -> dict[str, str]:
    cleaned = " ".join(str(value or "").strip(" :-,|").split())
    return {
        "raw_text": cleaned,
        "normalized_value": cleaned,
    }


def _valid_direct_value(field_key: str, value: str) -> bool:
    cleaned = " ".join(str(value or "").strip().split())
    if not cleaned:
        return False
    if field_key == "student_number":
        return bool(re.fullmatch(r"(?:PDM-?)?\d{4}-\d{4,7}", cleaned, re.I))
    if field_key == "academic_year":
        return bool(re.fullmatch(r"\d{4}\s*[-–]\s*\d{4}", cleaned))
    if field_key == "gwa":
        return bool(re.fullmatch(r"[1-5](?:\.\d{1,2})?", cleaned))
    forbidden_labels = (
        "student number",
        "student name",
        "academic year",
        "grade for the period",
    )
    return not any(label in cleaned.casefold() for label in forbidden_labels)


def _extract_layout_fields(
    full_text: str,
) -> dict[str, str]:
    """Extract values from forms whose header labels and values are separate."""

    extracted: dict[str, str] = {}
    normalized = " ".join(full_text.split())

    number_match = re.search(
        r"\b((?:PDM[-\s]?)?\d{4}[-\s]\d{4,7})\b",
        normalized,
        re.I,
    )
    if number_match:
        extracted["student_number"] = re.sub(
            r"\s+",
            "-",
            number_match.group(1).upper(),
        )

    header_match = re.search(
        r"STUDENT\s+NUMBER\s+STUDENT\s+NAME\s+COURSE\s*[:|\-]?\s*"
        r"(?:PDM[-\s]?)?\d{4}[-\s]\d{4,7}\s+"
        r"(?P<identity>.+?)\s+COPY\s+OF\s+GRADE(?:\s*FOR)?\b",
        normalized,
        re.I,
    )
    if header_match:
        identity = header_match.group("identity").strip(" :-,|")
        identity_match = re.match(
            r"(?P<name>.+?)\s+(?P<course>(?:BS|AB|B)[A-Z][A-Z0-9.\-]{1,12})$",
            identity,
            re.I,
        )
        if identity_match:
            extracted["student_name"] = " ".join(
                identity_match.group("name").replace(" ,", ",").split()
            )
            extracted["course"] = identity_match.group("course")

    period_match = re.search(
        r"GRADE\s*FOR\s+THE\s+PERIOD\s*[:\-]?\s*"
        r"(?P<semester>1ST|2ND|FIRST|SECOND|SUMMER)?"
        r"(?:\s+SEMESTER)?\s+"
        r"(?P<year>\d{4}\s*[-–]\s*\d{4})",
        normalized,
        re.I,
    )
    if period_match:
        semester = str(period_match.group("semester") or "").strip()
        if semester:
            extracted["semester"] = {
                "1ST": "1st Semester",
                "2ND": "2nd Semester",
                "FIRST": "First Semester",
                "SECOND": "Second Semester",
                "SUMMER": "Summer",
            }[semester.upper()]
        extracted["academic_year"] = re.sub(
            r"\s*[-–]\s*",
            "-",
            period_match.group("year"),
        )

    gwa_match = re.search(
        r"\bGWA\s*[:\-]?\s*([1-5](?:\.\d{1,2})?)\b",
        normalized,
        re.I,
    )
    if gwa_match:
        extracted["gwa"] = gwa_match.group(1)

    return extracted


def scan_grade_form(image_path: str) -> GradeFormResult:
    processed = fast_preprocess(image_path)
    if processed is None:
        return GradeFormResult(False, "", {}, {}, [{"code": "GRADE_FORM_IMAGE_UNAVAILABLE"}])

    kwargs = {
        "config": "--oem 3 --psm 6 -l eng",
        "output_type": Output.DICT,
    }
    try:
        data = pytesseract.image_to_data(
            processed,
            timeout=OCR_TIMEOUT_SECONDS,
            **kwargs,
        )
    except TypeError:  # Compatibility with older pytesseract releases.
        data = pytesseract.image_to_data(processed, **kwargs)

    lines: dict[tuple[int, int, int], list[tuple[str, float]]] = defaultdict(list)
    all_words: list[str] = []
    all_confidences: list[float] = []
    for index, word in enumerate(data.get("text", [])):
        text = str(word or "").strip()
        try:
            confidence = float(data.get("conf", [])[index])
        except (IndexError, TypeError, ValueError):
            continue
        if not text or confidence < 0:
            continue
        key = (
            int(data.get("block_num", [0])[index]),
            int(data.get("par_num", [0])[index]),
            int(data.get("line_num", [0])[index]),
        )
        lines[key].append((text, confidence))
        all_words.append(text)
        all_confidences.append(confidence)

    fields: dict[str, Any] = {"subjects": []}
    confidences: dict[str, float | None] = {}
    for words in lines.values():
        line = " ".join(word for word, _ in words)
        for field_key, pattern in FIELD_PATTERNS.items():
            if field_key in fields:
                continue
            match = pattern.search(line)
            if not match:
                continue
            value = match.group(1).strip(" :-")
            if _valid_direct_value(field_key, value):
                fields[field_key] = {
                    "raw_text": value,
                    "normalized_value": value,
                }
                confidences[field_key] = _confidence([confidence for _, confidence in words])

    raw_text = "\n".join(" ".join(word for word, _ in line) for line in lines.values())
    fallback_confidence = _confidence(all_confidences)
    for field_key, value in _extract_layout_fields(raw_text).items():
        if field_key in fields or not value:
            continue
        fields[field_key] = _field(value)
        confidences[field_key] = fallback_confidence

    anchors = sum(key in fields for key in FIELD_PATTERNS)
    matched = anchors >= 3 and "gwa" in fields
    if not matched:
        return GradeFormResult(
            False,
            raw_text or " ".join(all_words),
            {},
            {},
            [{
                "code": "GRADE_FORM_V1_TEMPLATE_MISMATCH",
                "message": "Approved grade form labels could not be registered.",
            }],
        )

    issues = []
    for key in FIELD_PATTERNS:
        if key not in fields:
            issues.append({
                "code": f"GRADE_FORM_{key.upper()}_MISSING",
                "message": f"{key.replace('_', ' ').title()} was not detected.",
            })
            fields[key] = {"raw_text": "", "normalized_value": ""}
            confidences[key] = None

    return GradeFormResult(True, raw_text, fields, confidences, issues)
