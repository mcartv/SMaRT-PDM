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
            if value:
                fields[field_key] = {
                    "raw_text": value,
                    "normalized_value": value,
                }
                confidences[field_key] = _confidence([confidence for _, confidence in words])

    anchors = sum(key in fields for key in FIELD_PATTERNS)
    matched = anchors >= 3 and "gwa" in fields
    if not matched:
        return GradeFormResult(
            False,
            " ".join(all_words),
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

    return GradeFormResult(True, "\n".join(" ".join(w for w, _ in line) for line in lines.values()), fields, confidences, issues)
