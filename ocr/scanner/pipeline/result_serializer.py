"""Convert document-specific worker output to the canonical API contract."""

from typing import Any

from models.ocr_result import ReviewCandidate


TEMPLATE_IDS = {
    "certificate_of_live_birth": "psa_birth_v1",
    "certificate_of_indigency": "indigency_v1",
    "student_grade_forms": "grade_form_v1",
}

DOCUMENT_KEY_ALIASES = {
    "certificate_of_birth": "certificate_of_live_birth",
    "psa_birth_certificate": "certificate_of_live_birth",
    "birth_certificate": "certificate_of_live_birth",
    "indigency": "certificate_of_indigency",
    "barangay_certificate": "certificate_of_indigency",
    "certificate_of_residency": "certificate_of_indigency",
    "barangay_clearance": "certificate_of_indigency",
}


def _canonical_document_key(request: dict[str, Any], payload: dict[str, Any]) -> str:
    extracted = payload.get("extracted_fields") or {}
    source = payload.get("source_payload") or {}
    candidates = (
        request.get("document_key"),
        extracted.get("document_type") if isinstance(extracted, dict) else None,
        payload.get("document_type"),
        source.get("document_key") if isinstance(source, dict) else None,
    )
    for candidate in candidates:
        normalized = str(candidate or "").strip().lower().replace(" ", "_")
        if not normalized:
            continue
        canonical = DOCUMENT_KEY_ALIASES.get(normalized, normalized)
        if canonical in TEMPLATE_IDS:
            return canonical
    return ""


def candidate_from_worker_payload(
    request: dict[str, Any],
    payload: dict[str, Any],
) -> ReviewCandidate:
    document_key = _canonical_document_key(request, payload)
    extracted = payload.get("extracted_fields") or {}
    fields = extracted.get("fields") if isinstance(extracted, dict) else {}
    if not isinstance(fields, dict):
        fields = {}
    confidence = payload.get("field_confidence") or {}
    if not isinstance(confidence, dict):
        confidence = {}
    issues = payload.get("validation_issues") or []
    source = payload.get("source_payload") or {}
    registration_status = str(source.get("registration_status") or "mismatch").lower()
    registration_accepted = registration_status in {
        "matched", "success", "registered",
    } or (
        document_key == "certificate_of_live_birth"
        and registration_status == "review_required"
    )
    if not registration_accepted:
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
        processing_metadata=(
            {
                "registration_mode": str(source.get("registration_mode") or ""),
                "ocr_version": str(
                    source.get("ocr_version") or request.get("ocr_version") or "v1"
                ),
                "topology_status": str(source.get("topology_status") or "unknown"),
                "topology_validated_row_count": int(
                    source.get("topology_validated_row_count") or 0
                ),
                "topology_rows": source.get("topology_rows") or {},
                "confidence_source": str(source.get("confidence_source") or ""),
                "ocr_engine": str(source.get("ocr_engine") or "tesseract"),
                "gemini_enabled": bool(source.get("gemini_enabled", False)),
                "gemini_status": str(source.get("gemini_status") or "disabled"),
                "gemini_model": str(source.get("gemini_model") or ""),
                "gemini_error_code": str(source.get("gemini_error_code") or ""),
                "row_identity_status": str(
                    source.get("row_identity_status") or "unknown"
                ),
                "row_identity_rows": source.get("row_identity_rows") or {},
                "diagnostic_only": bool(source.get("diagnostic_only", False)),
                "raw_text_mode": str(source.get("raw_text_mode") or ""),
                "calibration": source.get("calibration") or {},
            }
            if document_key == "certificate_of_live_birth"
            else {}
        ),
    )
