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
            "review_required": True,
            "contract_status": contract.status,
            "source_regions": list(contract.source_regions),
            "fields": {
                "child_name": {"first_name": "", "middle_name": "", "last_name": ""},
                "mother_maiden_name": {"first_name": "", "middle_name": "", "last_name": ""},
                "father_name": {"first_name": "", "middle_name": "", "last_name": ""},
            },
        }

    return {
        "document_type": contract.document_key,
        "review_required": True,
        "contract_status": contract.status,
        "source_regions": list(contract.source_regions),
        "fields": {},
    }
