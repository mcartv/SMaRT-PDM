"""Convert document-specific worker output to the canonical API contract."""

from typing import Any

from models.ocr_result import ReviewCandidate


TEMPLATE_IDS = {
    "certificate_of_live_birth": "psa_birth_v1",
    "certificate_of_indigency": "indigency_v1",
    "student_grade_forms": "grade_form_v1",
}


def candidate_from_worker_payload(
    request: dict[str, Any],
    payload: dict[str, Any],
) -> ReviewCandidate:
    document_key = str(request.get("document_key") or "")
    extracted = payload.get("extracted_fields") or {}
    fields = extracted.get("fields") if isinstance(extracted, dict) else {}
    if not isinstance(fields, dict):
        fields = {}
    confidence = payload.get("field_confidence") or {}
    if not isinstance(confidence, dict):
        confidence = {}
    issues = payload.get("validation_issues") or []
    source = payload.get("source_payload") or {}
    registration_status = str(source.get("registration_status") or "mismatch")
    if registration_status not in {"matched", "success", "registered"}:
        registration_status = "mismatch"
        fields = {}
        confidence = {}
        issues = [
            *issues,
            {
                "code": f"{TEMPLATE_IDS.get(document_key, 'UNKNOWN').upper()}_TEMPLATE_MISMATCH",
                "message": "Approved template registration failed.",
            },
        ]
    return ReviewCandidate(
        request_id=str(request.get("request_id") or request.get("id") or ""),
        document_key=document_key,
        template_id=TEMPLATE_IDS.get(document_key, "unknown"),
        raw_text=str(payload.get("raw_text") or ""),
        fields=fields,
        field_confidence=confidence,
        validation_issues=issues,
        registration_status=registration_status,
    )
