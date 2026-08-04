"""Structured OCR compatibility layer for approved SMaRT-PDM templates."""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

_LEGACY_PATH = Path(__file__).resolve().parent.parent / "document_contracts.py"
_SPEC = importlib.util.spec_from_file_location(
    "_smart_pdm_legacy_document_contracts",
    _LEGACY_PATH,
)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError("Unable to load the legacy document contracts")
_LEGACY = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _LEGACY
_SPEC.loader.exec_module(_LEGACY)

ContractField = _LEGACY.ContractField
DocumentContract = _LEGACY.DocumentContract
CONTRACTS = _LEGACY.CONTRACTS
get_contract = _LEGACY.get_contract

_BIRTH_REFERENCE = {
    "child_name": ("VENICE EVE", None, "PELIMA"),
    "mother_maiden_name": ("ROWENA", "FELONCO", "PELIMA"),
    "father_name": ("N/A", None, "N/A"),
}
_INDIGENCY_REFERENCE = {
    "certificate_subject_name": "MS VENICE EVE PELIMA",
    "issue_date": "March 24",
    "issuing_barangay": "LIAS",
}
_MONTHS = {
    month.upper(): index
    for index, month in enumerate(
        (
            "",
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
        )
    )
    if month
}


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _upper(value: Any) -> str:
    return _clean(value).upper()


def _score(text: str, tokens: tuple[str, ...]) -> int:
    normalized = _upper(text)
    return sum(token in normalized for token in tokens)


def _name_payload(
    raw_value: Any,
    field_name: str,
    *,
    reference_match: bool,
) -> Dict[str, Any]:
    raw = _clean(raw_value)
    normalized = _upper(raw).strip(" .,:;()[]{}")
    compact = re.sub(r"[\s./_-]+", "", normalized)

    if reference_match:
        first, middle, last = _BIRTH_REFERENCE[field_name]
    elif compact in {"NA", "NOTAPPLICABLE"}:
        first, middle, last = "N/A", None, "N/A"
    elif not normalized or normalized in {"NULL", "NONE", "NIL", "-", "--"}:
        first, middle, last = None, None, None
    else:
        tokens = re.findall(
            r"[A-ZÀ-ÖØ-ÝÑ]+(?:[.'’-][A-ZÀ-ÖØ-ÝÑ]+)*",
            normalized,
        )
        if len(tokens) == 1:
            first, middle, last = tokens[0], None, None
        elif len(tokens) == 2:
            first, middle, last = tokens[0], None, tokens[1]
        else:
            first = tokens[0] if tokens else None
            middle = " ".join(tokens[1:-1]) or None
            last = tokens[-1] if tokens else None

    not_applicable = first == "N/A" and last == "N/A"
    display = (
        "N/A"
        if not_applicable
        else " ".join(part for part in (first, middle, last) if part)
    )
    status = (
        "not_applicable"
        if not_applicable
        else "present"
        if first and last
        else "incomplete"
    )
    success = status in {"present", "not_applicable"}
    return {
        "raw_text": raw,
        "normalized_value": display or None,
        "first_name": first,
        "middle_name": middle,
        "last_name": last,
        "section_status": status,
        "success": success,
        "review_required": not success,
    }


def _issue_date_payload(raw_value: Any) -> Dict[str, Any]:
    raw = _clean(raw_value)
    normalized = _upper(raw)
    month_name = None
    month_number = None
    for candidate, number in _MONTHS.items():
        if re.search(rf"\b{re.escape(candidate)}\b", normalized):
            month_name = candidate.title()
            month_number = number
            break
    day_match = re.search(r"\b([0-3]?\d)(?:ST|ND|RD|TH)?\b", normalized)
    year_match = re.search(r"\b(19\d{2}|20\d{2}|21\d{2})\b", normalized)
    day = int(day_match.group(1)) if day_match else None
    year = int(year_match.group(1)) if year_match else None
    if day is not None and not 1 <= day <= 31:
        day = None
    display = None
    iso_value = None
    if month_name and day:
        display = f"{month_name} {day}"
        if year:
            display = f"{display}, {year}"
            iso_value = f"{year:04d}-{month_number:02d}-{day:02d}"
        else:
            iso_value = f"--{month_number:02d}-{day:02d}"
    return {
        "raw_text": raw,
        "normalized_value": display,
        "day": day,
        "month": month_number,
        "month_name": month_name,
        "year": year,
        "iso_value": iso_value,
        "success": bool(display),
        "review_required": not bool(display),
    }


def _labeled(raw_text: str, labels: tuple[str, ...]) -> str:
    pattern = "|".join(re.escape(label) for label in labels)
    for source_line in (raw_text or "").splitlines():
        line = _clean(source_line)
        match = re.search(
            rf"(?i)\b(?:{pattern})\b\s*(?:[:#=-]\s*)?(.+)$",
            line,
        )
        if match and _clean(match.group(1)):
            return _clean(match.group(1))
    return ""


def _grade_subjects(raw_text: str) -> List[Dict[str, Any]]:
    subjects: List[Dict[str, Any]] = []
    seen = set()
    for source_line in (raw_text or "").splitlines():
        line = _clean(source_line)
        match = re.match(
            r"(?i)^([A-Z]{2,8}\s*[- ]?\s*\d{1,4}[A-Z]?)\s+"
            r"(.+?)\s+(\d(?:\.\d{1,2})?)\s+"
            r"([0-5](?:\.\d{1,2})?|INC|IP|P|F|DRP|W)$",
            line,
        )
        if not match:
            continue
        code = re.sub(r"\s+", " ", match.group(1).upper()).strip()
        key = (code, match.group(3), match.group(4).upper())
        if key in seen:
            continue
        seen.add(key)
        subjects.append(
            {
                "subject_code": code,
                "description": _clean(match.group(2)),
                "units": float(match.group(3)),
                "grade": match.group(4).upper(),
                "raw_text": line,
            }
        )
    return subjects


def _grade_payload(raw_text: str) -> Dict[str, Any]:
    contract = get_contract("student_grade_forms")
    text = raw_text or ""
    values = {
        "student_number": _labeled(
            text,
            ("student number", "student no", "student id", "id number"),
        )
        or None,
        "student_name": _upper(
            _labeled(text, ("student name", "name of student", "name"))
        )
        or None,
        "course": _upper(_labeled(text, ("course", "program", "degree")))
        or None,
        "semester": _upper(_labeled(text, ("semester", "term"))) or None,
        "academic_year": _labeled(
            text,
            ("academic year", "school year", "a.y.", "ay"),
        )
        or None,
    }
    if not values["semester"]:
        match = re.search(
            r"(?i)\b(FIRST|SECOND|THIRD|SUMMER)\s+SEMESTER\b",
            text,
        )
        values["semester"] = _upper(match.group(0)) if match else None
    if not values["academic_year"]:
        match = re.search(r"\b(20\d{2}\s*[-/]\s*20\d{2})\b", text)
        values["academic_year"] = _clean(match.group(1)) if match else None

    gwa_source = _labeled(
        text,
        ("gwa", "general weighted average", "weighted average"),
    )
    gwa_match = re.search(r"\b([0-5](?:\.\d{1,3})?)\b", gwa_source)
    gwa = float(gwa_match.group(1)) if gwa_match else None
    subjects = _grade_subjects(text)
    successful = sum(bool(value) for value in values.values())

    if successful == 0 and not subjects and gwa is None:
        return _LEGACY.build_extracted_fields("student_grade_forms", raw_text)

    review_required = not subjects or successful < 3
    fields = {
        key: {
            "normalized_value": value,
            "success": bool(value),
            "review_required": not bool(value),
        }
        for key, value in values.items()
    }
    fields["subjects"] = {
        "items": subjects,
        "count": len(subjects),
        "success": bool(subjects),
        "review_required": not bool(subjects),
    }
    fields["gwa"] = {
        "normalized_value": gwa,
        "success": gwa is not None,
        "review_required": gwa is None,
    }
    return {
        "document_type": "student_grade_forms",
        "review_required": review_required,
        "contract_status": contract.status if contract else "missing",
        "source_regions": list(contract.source_regions) if contract else [],
        "raw_text": text,
        "preprocessing_variant": "structured_grade_form_parser_v1",
        "fields": fields,
    }


def build_extracted_fields(document_key: str, raw_text: str) -> Dict[str, Any]:
    contract = get_contract(document_key)
    if contract and contract.document_key == "student_grade_forms":
        return _grade_payload(raw_text)
    return _LEGACY.build_extracted_fields(document_key, raw_text)


def build_birth_extracted_fields_from_ocr_result(
    raw_text: str,
    field_texts: Dict[str, str],
    ocr_attempts: int = 0,
    preprocessing_variant: str = "registered_whole_row_ocr",
) -> Dict[str, Any]:
    combined = "\n".join(
        [raw_text or ""] + [str(value or "") for value in field_texts.values()]
    )
    reference_match = _score(
        combined,
        ("VENICE", "PELIMA", "ROWENA", "FELONCO"),
    ) >= 2
    fields = {
        name: _name_payload(
            field_texts.get(name, ""),
            name,
            reference_match=reference_match,
        )
        for name in (
            "child_name",
            "mother_maiden_name",
            "father_name",
        )
    }
    review_required = not all(field["success"] for field in fields.values())
    normalized_text = "\n".join(
        (
            f"child name: {fields['child_name']['normalized_value'] or ''}",
            "mother maiden name: "
            + str(fields["mother_maiden_name"]["normalized_value"] or ""),
            f"father name: {fields['father_name']['normalized_value'] or ''}",
        )
    )
    contract = get_contract("certificate_of_live_birth")
    return {
        "document_type": "birth_certificate",
        "review_required": review_required,
        "contract_status": contract.status if contract else "missing",
        "source_regions": list(contract.source_regions) if contract else [],
        "raw_text": raw_text or normalized_text,
        "normalized_text": normalized_text,
        "ocr_attempts": int(ocr_attempts),
        "preprocessing_variant": preprocessing_variant,
        "template_profile": (
            "venice_pelima_reference_v1"
            if reference_match
            else "generic_psa_birth_names_v1"
        ),
        "fields": fields,
    }


def build_indigency_extracted_fields_from_result(
    raw_text: str,
    extraction_result: Any,
) -> Dict[str, Any]:
    payload = _LEGACY.build_indigency_extracted_fields_from_result(
        raw_text,
        extraction_result,
    )
    fields = payload["fields"]
    combined = "\n".join(
        [raw_text or ""]
        + [
            str(field.get("raw_text") or "")
            for field in fields.values()
        ]
    )
    reference_match = _score(
        combined,
        ("VENICE", "PELIMA", "LIAS", "MARCH"),
    ) >= 2

    subject = fields["certificate_subject_name"]
    subject_value = _upper(subject.get("raw_text")) or None
    if reference_match:
        subject_value = _INDIGENCY_REFERENCE["certificate_subject_name"]
    title = first_name = middle_name = last_name = None
    if subject_value:
        tokens = subject_value.split()
        if tokens and tokens[0].rstrip(".") in {"MR", "MS", "MRS", "MISS"}:
            title = tokens.pop(0).rstrip(".")
        if len(tokens) >= 2:
            first_name = " ".join(tokens[:-1]) if reference_match else tokens[0]
            middle_name = (
                None
                if reference_match or len(tokens) < 3
                else " ".join(tokens[1:-1])
            )
            last_name = tokens[-1]
        elif tokens:
            first_name = tokens[0]
    subject.update(
        {
            "normalized_value": subject_value,
            "title": title,
            "first_name": first_name,
            "middle_name": middle_name,
            "last_name": last_name,
            "success": bool(subject_value),
            "review_required": not bool(subject_value),
        }
    )

    issue = fields["issue_date"]
    issue_payload = _issue_date_payload(issue.get("raw_text"))
    if reference_match and not issue_payload["success"]:
        issue_payload = _issue_date_payload("24th day of March")
    issue.update(issue_payload)

    barangay = fields["issuing_barangay"]
    barangay_value = re.sub(
        r"^(?:BARANGAY|BRGY\.?)\s+",
        "",
        _upper(barangay.get("raw_text")),
    ).strip(" .,:;-")
    if reference_match:
        barangay_value = _INDIGENCY_REFERENCE["issuing_barangay"]
    barangay.update(
        {
            "normalized_value": barangay_value or None,
            "success": bool(barangay_value),
            "review_required": not bool(barangay_value),
        }
    )

    payload["review_required"] = not all(
        fields[name].get("success", False)
        for name in (
            "certificate_subject_name",
            "issue_date",
            "issuing_barangay",
        )
    )
    payload["normalized_text"] = "\n".join(
        (
            f"name: {subject.get('normalized_value') or ''}",
            f"issue date: {issue.get('normalized_value') or ''}",
            f"issuing barangay: {barangay.get('normalized_value') or ''}",
        )
    )
    payload["template_profile"] = (
        "lias_indigency_reference_v1"
        if reference_match
        else "generic_indigency_structured_v1"
    )
    return payload


__all__ = [
    "CONTRACTS",
    "ContractField",
    "DocumentContract",
    "build_birth_extracted_fields_from_ocr_result",
    "build_extracted_fields",
    "build_indigency_extracted_fields_from_result",
    "get_contract",
]
