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

_INDIGENCY_CONTRACT = DocumentContract(
    document_key="certificate_of_indigency",
    document_type="Certificate of Indigency",
    status="approved",
    source_regions=["Certification clause", "Issue date clause", "Issuing office header"],
    fields=[
        ContractField("certificate_subject_name"),
        ContractField("issue_date"),
        ContractField("issuing_barangay"),
    ],
)


CONTRACTS: Dict[str, DocumentContract] = {
    "certificate_of_birth": _BIRTH_CONTRACT,
    "certificate_of_live_birth": _BIRTH_CONTRACT,
    "psa_birth_certificate": _BIRTH_CONTRACT,
    "birth_certificate": _BIRTH_CONTRACT,
    "certificate_of_indigency": _INDIGENCY_CONTRACT,
    "indigency": _INDIGENCY_CONTRACT,
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


def build_birth_extracted_fields_from_ocr_result(
    raw_text: str,
    field_texts: Dict[str, str],
    ocr_attempts: int = 0,
    preprocessing_variant: str = "registered_whole_row_ocr",
) -> Dict[str, Any]:
    contract = get_contract("certificate_of_live_birth")
    fields = {
        name: {
            "raw_text": value,
            "review_required": True,
        }
        for name, value in field_texts.items()
    }
    return {
        "document_type": "birth_certificate",
        "review_required": True,
        "contract_status": contract.status if contract else "missing",
        "source_regions": list(contract.source_regions) if contract else [],
        "raw_text": raw_text or "",
        "ocr_attempts": int(ocr_attempts),
        "preprocessing_variant": preprocessing_variant,
        "fields": fields,
    }


def build_indigency_extracted_fields_from_result(
    raw_text: str,
    extraction_result: Any,
) -> Dict[str, Any]:
    contract = get_contract("certificate_of_indigency")
    result_fields = {
        str(field.name): field
        for field in getattr(getattr(extraction_result, "data", None), "fields", ())
    }
    fields: Dict[str, Any] = {}
    for field_name in (
        "certificate_subject_name",
        "issue_date",
        "issuing_barangay",
    ):
        field = result_fields.get(field_name)
        fields[field_name] = {
            "raw_text": str(getattr(field, "raw_text", "") or ""),
            "success": bool(getattr(field, "success", False)),
            "review_required": True,
            "issue_codes": list(getattr(field, "issue_codes", ())),
            "detection_variant": str(
                getattr(field, "detection_variant", "") or ""
            ),
            "anchor": str(getattr(field, "anchor", "") or ""),
            "normalized_bounds": getattr(field, "normalized_bounds", None),
        }

    return {
        "document_type": "certificate_of_indigency",
        "review_required": True,
        "contract_status": contract.status if contract else "missing",
        "source_regions": list(contract.source_regions) if contract else [],
        "raw_text": raw_text or "",
        "preprocessing_variant": str(
            getattr(
                getattr(extraction_result, "data", None),
                "detection_variant",
                "",
            )
            or ""
        ),
        "fields": fields,
    }
