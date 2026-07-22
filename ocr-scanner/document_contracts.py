"""
document_contracts.py - Document-specific OCR contract metadata and extractors.

The current implementation stays conservative:
- Approved contracts can return structured fields.
- Pending contracts return an empty structured payload with admin review flags.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping


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
    candidate_sources = {"pre_title_header", "none", "ambiguous"}
    value_sources = {"positional", "crop_ocr", "none"}
    positional_statuses = {
        "valid",
        "invalid",
        "not_attempted",
        "not_implemented",
    }
    crop_statuses = {
        "not_attempted",
        "empty",
        "valid",
        "invalid",
        "non_empty_accepted",
        "exception",
    }
    failure_stages = {
        "none",
        "candidate_selection",
        "crop_generation",
        "crop_ocr",
    }

    def diagnostic_value(diagnostics: Any, name: str, default: Any) -> Any:
        if isinstance(diagnostics, Mapping):
            return diagnostics.get(name, default)
        return getattr(diagnostics, name, default)

    def numeric_sequence(diagnostics: Any, name: str) -> list[float | int]:
        value = diagnostic_value(diagnostics, name, ()) or ()
        if not isinstance(value, (list, tuple)):
            return []
        return [item for item in value if isinstance(item, (int, float))]

    for field_name in (
        "certificate_subject_name",
        "issue_date",
        "issuing_barangay",
    ):
        field = result_fields.get(field_name)
        field_payload = {
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
        diagnostics = getattr(field, "diagnostics", None)
        if diagnostics is not None:
            candidate_source = str(
                diagnostic_value(diagnostics, "candidate_source", "none") or "none"
            )
            crop_status = str(
                diagnostic_value(
                    diagnostics,
                    "crop_validation_status",
                    "not_attempted",
                )
                or "not_attempted"
            )
            failure_stage = str(
                diagnostic_value(diagnostics, "failure_stage", "none") or "none"
            )
            value_source = str(
                diagnostic_value(diagnostics, "value_source", "none") or "none"
            )
            positional_status = str(
                diagnostic_value(
                    diagnostics,
                    "positional_validation_status",
                    "not_attempted",
                )
                or "not_attempted"
            )
            field_payload["diagnostics"] = {
                "candidate_found": bool(
                    diagnostic_value(diagnostics, "candidate_found", False)
                ),
                "candidate_count": max(
                    0,
                    int(diagnostic_value(diagnostics, "candidate_count", 0) or 0),
                ),
                "candidate_token_count": max(
                    0,
                    int(
                        diagnostic_value(diagnostics, "candidate_token_count", 0)
                        or 0
                    ),
                ),
                "candidate_word_confidences": numeric_sequence(
                    diagnostics,
                    "candidate_word_confidences",
                ),
                "candidate_horizontal_gaps": numeric_sequence(
                    diagnostics,
                    "candidate_horizontal_gaps",
                ),
                "candidate_word_count_before_filter": max(
                    0,
                    int(
                        diagnostic_value(
                            diagnostics,
                            "candidate_word_count_before_filter",
                            0,
                        )
                        or 0
                    ),
                ),
                "candidate_word_count_after_filter": max(
                    0,
                    int(
                        diagnostic_value(
                            diagnostics,
                            "candidate_word_count_after_filter",
                            0,
                        )
                        or 0
                    ),
                ),
                "candidate_source": (
                    candidate_source
                    if candidate_source in candidate_sources
                    else "none"
                ),
                "anchor_found": bool(
                    diagnostic_value(diagnostics, "anchor_found", False)
                ),
                "bounds_present": bool(
                    diagnostic_value(diagnostics, "bounds_present", False)
                ),
                "crop_attempted": bool(
                    diagnostic_value(diagnostics, "crop_attempted", False)
                ),
                "crop_returned_text": bool(
                    diagnostic_value(diagnostics, "crop_returned_text", False)
                ),
                "value_source": (
                    value_source if value_source in value_sources else "none"
                ),
                "positional_validation_status": (
                    positional_status
                    if positional_status in positional_statuses
                    else "not_attempted"
                ),
                "crop_validation_status": (
                    crop_status
                    if crop_status in crop_statuses
                    else "not_attempted"
                ),
                "failure_stage": (
                    failure_stage
                    if failure_stage in failure_stages
                    else "none"
                ),
            }
        fields[field_name] = field_payload

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
