"""
document_contracts.py - Document-specific OCR contract metadata and extractors.

The current implementation stays conservative:
- Approved contracts can return structured fields.
- Pending contracts return an empty structured payload with admin review flags.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass(frozen=True)
class ContractField:
    name: str
    status: str = "approved"


@dataclass(frozen=True)
class DocumentContract:
    document_key: str
    document_type: str
    status: str
    source_regions: List[str]
    fields: List[ContractField]


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _split_name(name: str) -> Dict[str, str]:
    cleaned = _normalize_text(name)
    if not cleaned:
        return {"first_name": "", "middle_name": "", "last_name": ""}

    parts = cleaned.split(" ")
    if len(parts) == 1:
        return {"first_name": parts[0], "middle_name": "", "last_name": ""}
    if len(parts) == 2:
        return {"first_name": parts[0], "middle_name": "", "last_name": parts[1]}

    return {
        "first_name": parts[0],
        "middle_name": " ".join(parts[1:-1]),
        "last_name": parts[-1],
    }


def _title_case_preserve_tokens(value: str) -> str:
    cleaned = _normalize_text(value)
    if not cleaned:
        return ""
    return " ".join(part[:1].upper() + part[1:].lower() if part else part for part in cleaned.split(" "))


_BIRTH_CONTRACT = DocumentContract(
    document_key="certificate_of_live_birth",
    document_type="Birth Certificate",
    status="approved",
    source_regions=["Item 1", "Item 6", "Item 13"],
    fields=[
        ContractField("document_type"),
        ContractField("child_name"),
        ContractField("mother_maiden_name"),
        ContractField("father_name"),
    ],
)


CONTRACTS: Dict[str, DocumentContract] = {
    "certificate_of_birth": _BIRTH_CONTRACT,
    "certificate_of_live_birth": _BIRTH_CONTRACT,
    "psa_birth_certificate": _BIRTH_CONTRACT,
    "birth_certificate": _BIRTH_CONTRACT,
    "certificate_of_indigency": DocumentContract(
        document_key="certificate_of_indigency",
        document_type="Certificate of Indigency",
        status="pending_approval",
        source_regions=["Applicant name", "Address", "Issue date"],
        fields=[
            ContractField("name", status="pending_approval"),
            ContractField("address", status="pending_approval"),
            ContractField("barangay", status="pending_approval"),
            ContractField("municipality", status="pending_approval"),
            ContractField("province", status="pending_approval"),
            ContractField("issue_date", status="pending_approval"),
        ],
    ),
    "student_grade_forms": DocumentContract(
        document_key="student_grade_forms",
        document_type="Student Grade Form",
        status="pending_approval",
        source_regions=["Header", "Student Info", "Subjects Table", "GWA"],
        fields=[
            ContractField("student_number", status="pending_approval"),
            ContractField("student_name", status="pending_approval"),
            ContractField("course", status="pending_approval"),
            ContractField("semester", status="pending_approval"),
            ContractField("academic_year", status="pending_approval"),
            ContractField("subjects", status="pending_approval"),
            ContractField("gwa", status="pending_approval"),
        ],
    ),
}


def get_contract(document_key: str) -> DocumentContract | None:
    return CONTRACTS.get((document_key or "").strip())


def extract_birth_certificate_fields(raw_text: str) -> Dict[str, Any]:
    """
    Conservative extractor for the approved PSA birth certificate contract.
    It only attempts the specified name fields and leaves low-confidence data blank.
    """

    lines = [_normalize_text(line) for line in (raw_text or "").splitlines() if _normalize_text(line)]
    upper_lines = [line.upper() for line in lines]

    def find_line_after(marker: str) -> str:
        marker = marker.upper()
        for idx, line in enumerate(upper_lines):
            if marker in line:
                for candidate in lines[idx + 1 : idx + 4]:
                    if candidate:
                        return candidate
        return ""

    child_name = find_line_after("1. NAME")
    mother_name = find_line_after("6. MAIDEN NAME")
    father_name = find_line_after("13. NAME")

    return {
        "document_type": "birth_certificate",
        "child_name": _split_name(_title_case_preserve_tokens(child_name)),
        "mother_maiden_name": _split_name(_title_case_preserve_tokens(mother_name)),
        "father_name": _split_name(_title_case_preserve_tokens(father_name)),
    }


def build_extracted_fields(document_key: str, raw_text: str) -> Dict[str, Any]:
    contract = get_contract(document_key)
    if not contract:
        return {
            "document_type": "unknown_document",
            "review_required": True,
            "contract_status": "missing",
            "fields": {},
        }

    if contract.document_key == "certificate_of_live_birth":
        return {
            "document_type": "birth_certificate",
            **extract_birth_certificate_fields(raw_text),
        }

    return {
        "document_type": contract.document_key,
        "review_required": True,
        "contract_status": contract.status,
        "source_regions": contract.source_regions,
        "fields": {},
    }
