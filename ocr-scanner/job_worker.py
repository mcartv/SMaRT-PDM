#!/usr/bin/env python3
"""
job_worker.py - Pull-based Pi worker for SMaRT-PDM IoT OCR.

Flow:
1. Poll GET /api/pi/iot-ocr/next
2. Claim one pending request
3. Run one shared preview-first capture session
4. LEFT captures once; RIGHT cancels before capture
5. Route the captured image to one document pipeline
6. Submit the result to POST /api/pi/iot-ocr/:requestId/result
"""

import logging
import os
import signal
import shutil
import threading
import time
from pathlib import Path
from typing import Any, Dict, Tuple

import cv2
import pytesseract

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - test/runtime fallback
    def load_dotenv(*_args, **_kwargs):
        return False

from api import ApiClient
from capture_session import CANCELLED, CAPTURED, CaptureSessionResult, run_capture_session
from camera import CameraController
from document_contracts import (
    build_birth_extracted_fields_from_ocr_result,
    build_extracted_fields,
    build_indigency_extracted_fields_from_result,
    get_contract,
)
from extraction.indigency_core_field_extraction import (
    IndigencyExtractionConfig,
    extract_indigency_core_fields,
)
from extraction.psa_birth_row_cropper import crop_psa_birth_name_rows
from extraction.psa_birth_row_ocr import extract_psa_birth_row_text
from extraction.psa_form_registration import register_psa_birth_form
from ocr import extract_text, get_last_ocr_confidence
from pipeline.result_serializer import candidate_from_worker_payload

WORKER_ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(dotenv_path=WORKER_ENV_PATH, override=True)

POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "1"))
FAST_REVIEW_OCR_ENABLED = (
    os.getenv("FAST_REVIEW_OCR_ENABLED", "true").strip().lower()
    not in {"0", "false", "no", "off"}
)
INDIGENCY_MAX_WIDTH = max(
    960,
    int(os.getenv("INDIGENCY_MAX_WIDTH", "1600")),
)
INDIGENCY_OCR_TIMEOUT_SECONDS = max(
    5.0,
    float(os.getenv("INDIGENCY_OCR_TIMEOUT_SECONDS", "25")),
)
INDIGENCY_FIELD_TIMEOUT_SECONDS = max(
    3.0,
    float(os.getenv("INDIGENCY_FIELD_TIMEOUT_SECONDS", "8")),
)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("iot-worker")
_shutdown_requested = threading.Event()


def clear_tmp_files() -> None:
    for path in ["/tmp/ocr_raw.txt", "/tmp/ocr_result.txt"]:
        try:
            with open(path, "w", encoding="utf-8") as file:
                file.write("")
        except Exception as exc:
            log.warning("Failed clearing %s: %s", path, exc)


def write_text_file(path: str, text: str) -> None:
    try:
        with open(path, "w", encoding="utf-8") as file:
            file.write(text or "")
    except Exception:
        log.warning("Failed writing OCR compatibility output")


def _run_generic_ocr(
    capture_path: str,
    *,
    text_reader=None,
    text_corrector=None,
) -> Tuple[str, str]:
    clear_tmp_files()
    resolved_reader = text_reader if text_reader is not None else extract_text
    try:
        raw_text = (resolved_reader(capture_path) or "").strip()
    except Exception:
        raw_text = ""
    if not raw_text:
        return "", ""

    try:
        if text_corrector is None and FAST_REVIEW_OCR_ENABLED:
            corrected_text = raw_text
        else:
            if text_corrector is None:
                from spell_check import correct_ocr_text

                text_corrector = correct_ocr_text

            corrected_text = (
                (text_corrector(raw_text, aggressive=False) or raw_text).strip()
                or raw_text
            )
    except Exception:
        corrected_text = raw_text

    write_text_file("/tmp/ocr_raw.txt", raw_text)
    write_text_file("/tmp/ocr_result.txt", corrected_text)
    return raw_text, corrected_text


def build_document_type(request: Dict) -> str:
    return request.get("document_type") or request.get("document_key") or "Document"


def get_request_id(request: Dict) -> str:
    return str(request.get("request_id") or request.get("id") or "")


def _safe_request_ref(request_id: str) -> str:
    normalized = str(request_id or "")
    return f"{normalized[:8]}..." if len(normalized) > 8 else normalized or "missing"


def _issue_codes(stage_result) -> list[str]:
    return [str(issue.get("code", "")) for issue in getattr(stage_result, "issues", []) if issue.get("code")]


def _is_birth_certificate_job(request: Dict) -> bool:
    document_key = str(request.get("document_key") or "").strip()
    contract = get_contract(document_key)
    return bool(contract and contract.document_key == "certificate_of_live_birth")


def _is_indigency_job(request: Dict) -> bool:
    document_key = str(request.get("document_key") or "").strip()
    contract = get_contract(document_key)
    return bool(contract and contract.document_key == "certificate_of_indigency")


def _empty_birth_extracted_fields() -> Dict[str, object]:
    return {
        "document_type": "birth_certificate",
        "review_required": True,
        "contract_status": "approved",
        "source_regions": ["Item 1", "Item 6", "Item 13"],
        "raw_text": "",
        "ocr_attempts": 0,
        "preprocessing_variant": "registered_whole_row_ocr",
        "fields": {},
    }


def _load_registered_image(path: str) -> Any:
    image = cv2.imread(path)
    if image is None or image.size == 0:
        return None
    return image


def _fast_indigency_field_reader(
    image: Any,
    _field_name: str,
) -> str:
    config = "--oem 3 --psm 7 -l eng"
    try:
        try:
            return pytesseract.image_to_string(
                image,
                config=config,
                timeout=INDIGENCY_FIELD_TIMEOUT_SECONDS,
            )
        except TypeError:
            return pytesseract.image_to_string(
                image,
                config=config,
            )
    except Exception:
        return ""


def _normalize_indigency_snapshot_value(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _build_indigency_structured_raw_text(
    extracted_fields: Dict[str, Any],
) -> str:
    # Persist only successful values returned by structured OCR.
    definitions = (
        ("certificate_subject_name", "Certificate Subject Name"),
        ("issue_date", "Issue Date"),
        ("issuing_barangay", "Issuing Barangay"),
    )
    fields = (
        extracted_fields.get("fields", {})
        if isinstance(extracted_fields, dict)
        else {}
    )
    lines = []
    observed_values = []

    for field_key, label in definitions:
        field = fields.get(field_key, {})
        if not isinstance(field, dict):
            continue

        value = _normalize_indigency_snapshot_value(
            field.get("raw_text")
        )
        if field.get("success") is not True or not value:
            continue

        observed_values.append(value)
        lines.append(f"{label}: {value}")

    snapshot = "\n".join(lines)
    normalized_snapshot = _normalize_indigency_snapshot_value(
        snapshot
    ).casefold()

    if any(
        _normalize_indigency_snapshot_value(value).casefold()
        not in normalized_snapshot
        for value in observed_values
    ):
        raise RuntimeError(
            "Structured indigency field does not match raw_text."
        )

    return snapshot


def _registration_context(registration_result: Any) -> Dict[str, Any]:
    return {
        "status": getattr(registration_result, "status", ""),
        "issues": list(getattr(registration_result, "issues", [])),
        "transformation_metadata": getattr(
            getattr(registration_result, "data", None),
            "transformation_metadata",
            None,
        ),
    }


def _run_birth_certificate_scan(
    request: Dict,
    capture_path: str,
) -> Tuple[bool, Dict]:
    request_id = get_request_id(request)
    application_id = str(request.get("application_id") or "")
    student_id = str(request.get("student_id") or "")
    student_name = str(request.get("student_name") or "")
    document_key = str(request.get("document_key") or "")
    document_type = str(build_document_type(request))

    registration_result = None
    crop_result = None
    ocr_result = None
    status = "failed"
    error_message = None
    raw_text = ""
    extracted_fields = _empty_birth_extracted_fields()
    ocr_attempts = 0
    preprocessing_variant = "registered_whole_row_ocr"

    source_image = _load_registered_image(capture_path)
    if source_image is None:
        error_message = "Captured birth certificate image is unavailable."
        return False, {
            "status": status,
            "raw_text": raw_text,
            "ocr_confidence": None,
            "document_type": "birth_certificate",
            "manual_review_required": True,
            "ocr_attempts": ocr_attempts,
            "preprocessing_variant": preprocessing_variant,
            "extracted_fields": extracted_fields,
            "source_payload": {
                "source": "pi-worker-iot-ocr-request",
                "mode": "birth_certificate_pipeline",
                "request_id": request_id,
                "application_id": application_id,
                "student_id": student_id,
                "student_name": student_name,
                "document_key": document_key,
                "document_type": document_type,
                "document_contract_status": "approved",
                "registration_status": "failed",
                "registration_issue_codes": [],
                "cropper_status": "not_started",
                "cropper_issue_codes": [],
                "ocr_status": "not_started",
                "ocr_issue_codes": [],
                "manual_review_required": True,
                "worker_status": "failed",
                "ocr_attempts": ocr_attempts,
                "preprocessing_variant": preprocessing_variant,
                "structured_field_keys": [],
            },
            "error_message": error_message,
        }
    try:
        registration_result = register_psa_birth_form(source_image)
        if not registration_result.success:
            error_message = "Birth registration failed."
            return False, {
                "status": "failed",
                "raw_text": raw_text,
                "ocr_confidence": None,
                "document_type": "birth_certificate",
                "manual_review_required": True,
                "ocr_attempts": ocr_attempts,
                "preprocessing_variant": preprocessing_variant,
                "extracted_fields": extracted_fields,
                "source_payload": {
                    "source": "pi-worker-iot-ocr-request",
                    "mode": "birth_certificate_pipeline",
                    "request_id": request_id,
                    "application_id": application_id,
                    "student_id": student_id,
                    "student_name": student_name,
                    "document_key": document_key,
                    "document_type": document_type,
                    "document_contract_status": "approved",
                    "registration_status": registration_result.status,
                    "registration_issue_codes": _issue_codes(registration_result),
                    "cropper_status": "not_started",
                    "cropper_issue_codes": [],
                    "ocr_status": "not_started",
                    "ocr_issue_codes": [],
                    "manual_review_required": True,
                    "worker_status": "failed",
                    "ocr_attempts": ocr_attempts,
                    "preprocessing_variant": preprocessing_variant,
                    "structured_field_keys": [],
                },
                "error_message": error_message,
            }

        crop_result = crop_psa_birth_name_rows(
            registration_result.data.registered_image,
            registration_metadata=_registration_context(registration_result),
        )
        if not crop_result.success:
            error_message = "Birth row cropper failed."
            return False, {
                "status": "failed",
                "raw_text": raw_text,
                "ocr_confidence": None,
                "ocr_attempts": ocr_attempts,
                "preprocessing_variant": preprocessing_variant,
                "extracted_fields": extracted_fields,
                "source_payload": {
                    "source": "pi-worker-iot-ocr-request",
                    "mode": "birth_certificate_pipeline",
                    "request_id": request_id,
                    "application_id": application_id,
                    "student_id": student_id,
                    "student_name": student_name,
                    "document_key": document_key,
                    "document_type": document_type,
                    "document_contract_status": "approved",
                    "registration_status": registration_result.status,
                    "registration_issue_codes": _issue_codes(registration_result),
                    "cropper_status": crop_result.status,
                    "cropper_issue_codes": _issue_codes(crop_result),
                    "ocr_status": "not_started",
                    "ocr_issue_codes": [],
                    "manual_review_required": True,
                },
                "error_message": error_message,
            }

        ocr_result = extract_psa_birth_row_text(crop_result.data)
        extracted_fields = build_birth_extracted_fields_from_ocr_result(
            raw_text="\n".join(field.raw_text for field in getattr(ocr_result.data, "fields", ()) if field.raw_text),
            field_texts={field.name: field.raw_text for field in getattr(ocr_result.data, "fields", ())},
            ocr_attempts=int(ocr_result.metrics.get("total_ocr_attempts", len(getattr(ocr_result.data, "fields", ())))),
            preprocessing_variant=(
                ocr_result.data.fields[0].preprocessing_variant
                if getattr(ocr_result.data, "fields", ())
                else preprocessing_variant
            ),
        )
        raw_text = extracted_fields["raw_text"]
        ocr_attempts = int(extracted_fields["ocr_attempts"])
        preprocessing_variant = str(extracted_fields["preprocessing_variant"])
        status = "review_required" if ocr_result.success else "failed"
        error_message = None if ocr_result.success else "Birth OCR adapter failed."

        payload = {
            "status": status,
            "raw_text": raw_text,
            "ocr_confidence": None,
            "document_type": "birth_certificate",
            "manual_review_required": True,
            "ocr_attempts": ocr_attempts,
            "preprocessing_variant": preprocessing_variant,
            "extracted_fields": extracted_fields,
            "source_payload": {
                "source": "pi-worker-iot-ocr-request",
                "mode": "birth_certificate_pipeline",
                "request_id": request_id,
                "application_id": application_id,
                "student_id": student_id,
                "student_name": student_name,
                "document_key": document_key,
                "document_type": document_type,
                "document_contract_status": "approved",
                "registration_status": registration_result.status,
                "registration_issue_codes": _issue_codes(registration_result),
                "cropper_status": crop_result.status,
                "cropper_issue_codes": _issue_codes(crop_result),
                "ocr_status": ocr_result.status,
                "ocr_issue_codes": _issue_codes(ocr_result),
                "manual_review_required": True,
                "worker_status": ocr_result.status,
                "ocr_attempts": ocr_attempts,
                "preprocessing_variant": preprocessing_variant,
                "structured_field_keys": sorted(field.name for field in getattr(ocr_result.data, "fields", ())),
            },
            "error_message": error_message,
        }
        return status == "review_required", payload
    except Exception:
        return False, {
            "status": "failed",
            "raw_text": "",
            "ocr_confidence": None,
            "document_type": "birth_certificate",
            "manual_review_required": True,
            "ocr_attempts": 0,
            "preprocessing_variant": preprocessing_variant,
            "extracted_fields": _empty_birth_extracted_fields(),
            "source_payload": {
                "source": "pi-worker-iot-ocr-request",
                "mode": "birth_certificate_pipeline",
                "request_id": request_id,
                "document_key": document_key,
                "worker_status": "failed",
                "registration_status": "failed",
                "registration_issue_codes": ["BIRTH_PIPELINE_FAILED"],
                "cropper_status": "not_started",
                "cropper_issue_codes": [],
                "ocr_status": "not_started",
                "ocr_issue_codes": [],
                "manual_review_required": True,
                "structured_field_keys": [],
            },
            "error_message": "Birth pipeline failed.",
        }


def _capture_outcome_payload(
    request: Dict,
    capture_result: CaptureSessionResult,
) -> Tuple[bool, Dict]:
    request_id = get_request_id(request)
    application_id = str(request.get("application_id") or "")
    student_id = str(request.get("student_id") or "")
    student_name = str(request.get("student_name") or "")
    document_key = str(request.get("document_key") or "")
    document_type = str(build_document_type(request))
    cancelled = capture_result.status == CANCELLED
    status = "cancelled" if cancelled else "failed"
    error_message = (
        "IoT OCR was cancelled on the Pi."
        if cancelled
        else "Document capture failed."
    )

    if _is_birth_certificate_job(request):
        extracted_fields = _empty_birth_extracted_fields()
        source_payload = {
            "source": "pi-worker-iot-ocr-request",
            "mode": "birth_certificate_pipeline",
            "request_id": request_id,
            "application_id": application_id,
            "student_id": student_id,
            "student_name": student_name,
            "document_key": document_key,
            "document_type": document_type,
            "document_contract_status": "approved",
            "capture_status": capture_result.status,
            "capture_error_code": capture_result.error_code,
            "registration_status": "not_started",
            "registration_issue_codes": [],
            "cropper_status": "not_started",
            "cropper_issue_codes": [],
            "ocr_status": "not_started",
            "ocr_issue_codes": [],
            "manual_review_required": True,
            "worker_status": status,
            "ocr_attempts": 0,
            "preprocessing_variant": "registered_whole_row_ocr",
            "structured_field_keys": [],
        }
        return False, {
            "status": status,
            "raw_text": "",
            "ocr_confidence": None,
            "document_type": "birth_certificate",
            "manual_review_required": True,
            "ocr_attempts": 0,
            "preprocessing_variant": "registered_whole_row_ocr",
            "extracted_fields": extracted_fields,
            "source_payload": source_payload,
            "error_message": error_message,
        }

    extracted_fields = (
        build_indigency_extracted_fields_from_result("", None)
        if _is_indigency_job(request)
        else build_extracted_fields(document_key, "")
    )
    contract = get_contract(document_key)
    mode = (
        "indigency_structured_pipeline"
        if _is_indigency_job(request)
        else "shared_capture_generic_ocr"
    )
    source_payload = {
        "source": "pi-worker-iot-ocr-request",
        "mode": mode,
        "request_id": request_id,
        "application_id": application_id,
        "student_id": student_id,
        "student_name": student_name,
        "document_key": document_key,
        "document_type": document_type,
        "document_contract_status": contract.status if contract else "missing",
        "capture_status": capture_result.status,
        "capture_error_code": capture_result.error_code,
        "cancelled": cancelled,
        "returncode": 2 if cancelled else 1,
    }
    if _is_indigency_job(request):
        source_payload.update(
            {
                "ocr_status": "not_started",
                "ocr_issue_codes": [],
                "manual_review_required": True,
                "worker_status": status,
                "preprocessing_variant": "positional_ocr",
                "structured_field_keys": sorted(extracted_fields["fields"]),
            }
        )
    return False, {
        "status": status,
        "raw_text": "",
        "ocr_confidence": None,
        "document_type": (
            "certificate_of_indigency" if _is_indigency_job(request) else document_type
        ),
        "manual_review_required": True,
        "extracted_fields": extracted_fields,
        "source_payload": source_payload,
        "error_message": error_message,
    }


def _run_generic_document_scan(
    request: Dict,
    capture_path: str,
) -> Tuple[bool, Dict]:
    request_id = get_request_id(request)
    application_id = str(request.get("application_id") or "")
    student_id = str(request.get("student_id") or "")
    student_name = str(request.get("student_name") or "")
    document_key = str(request.get("document_key") or "")
    document_type = str(build_document_type(request))

    processing_started_at = time.monotonic()
    raw_text, corrected_text = _run_generic_ocr(capture_path)
    generic_ocr_seconds = time.monotonic() - processing_started_at
    log.info(
        "Whole-document OCR finished request=%s document=%s seconds=%.1f",
        _safe_request_ref(request_id),
        document_key,
        generic_ocr_seconds,
    )
    extracted_fields = build_extracted_fields(document_key, raw_text)
    contract = get_contract(document_key)
    if raw_text:
        status = "review_required"
        error_message = None
    else:
        status = "failed"
        error_message = "OCR scan failed or returned empty raw_text."

    if _is_indigency_job(request):
        extraction_result = None
        extraction_status = "not_started"
        extraction_issue_codes: list[str] = []
        extraction_seconds = 0.0
        if status == "review_required":
            try:
                source_image = _load_registered_image(capture_path)
                if source_image is None:
                    extraction_status = "failed"
                    extraction_issue_codes = ["INDIGENCY_SOURCE_IMAGE_UNAVAILABLE"]
                else:
                    extraction_started_at = time.monotonic()
                    extraction_result = extract_indigency_core_fields(
                        source_image,
                        field_reader=_fast_indigency_field_reader,
                        config=IndigencyExtractionConfig(
                            fast_mode=FAST_REVIEW_OCR_ENABLED,
                            maximum_detection_width=INDIGENCY_MAX_WIDTH,
                            ocr_timeout_seconds=INDIGENCY_OCR_TIMEOUT_SECONDS,
                        ),
                    )
                    extraction_seconds = (
                        time.monotonic() - extraction_started_at
                    )
                    log.info(
                        "Indigency structured OCR finished "
                        "request=%s seconds=%.1f fast_mode=%s",
                        _safe_request_ref(request_id),
                        extraction_seconds,
                        FAST_REVIEW_OCR_ENABLED,
                    )
                    extraction_status = str(
                        getattr(extraction_result, "status", "failed") or "failed"
                    )
                    extraction_issue_codes = _issue_codes(extraction_result)
            except Exception:
                extraction_result = None
                extraction_status = "failed"
                extraction_issue_codes = ["INDIGENCY_STRUCTURED_EXTRACTION_FAILED"]

            # Usable whole-document OCR remains the authoritative scan outcome.
            status = "review_required"
            error_message = None

        extracted_fields = build_indigency_extracted_fields_from_result(
            raw_text,
            extraction_result,
        )
        structured_raw_text = _build_indigency_structured_raw_text(
            extracted_fields
        )

        if structured_raw_text:
            raw_text = structured_raw_text
            corrected_text = structured_raw_text
            status = "review_required"
            error_message = None
        else:
            raw_text = ""
            corrected_text = ""
            status = "failed"
            error_message = (
                "Approved structured Certificate of Indigency fields "
                "were not extracted."
            )

        preprocessing_variant = str(
            extracted_fields.get("preprocessing_variant") or "positional_ocr"
        )
        payload = {
            "status": status,
            "raw_text": raw_text,
            "ocr_confidence": None,
            "document_type": "certificate_of_indigency",
            "manual_review_required": True,
            "preprocessing_variant": preprocessing_variant,
            "extracted_fields": extracted_fields,
            "source_payload": {
                "source": "pi-worker-iot-ocr-request",
                "mode": "indigency_structured_pipeline",
                "request_id": request_id,
                "application_id": application_id,
                "student_id": student_id,
                "student_name": student_name,
                "document_key": document_key,
                "document_type": document_type,
                "document_contract_status": "approved",
                "corrected_text": corrected_text,
                "capture_status": CAPTURED,
                "capture_error_code": None,
                "cancelled": False,
                "returncode": 0 if raw_text else 1,
                "ocr_status": extraction_status,
                "ocr_issue_codes": extraction_issue_codes,
                "manual_review_required": True,
                "worker_status": status,
                "preprocessing_variant": preprocessing_variant,
                "structured_field_keys": sorted(
                    extracted_fields.get("fields", {}).keys()
                ),
                "raw_text_mode": "structured_ocr_fields_only",
                "structured_raw_text_consistent": bool(raw_text),
                "generic_page_text_persisted": False,
                "generic_ocr_seconds": round(generic_ocr_seconds, 3),
                "structured_ocr_seconds": round(extraction_seconds, 3),
                "processing_seconds": round(
                    time.monotonic() - processing_started_at,
                    3,
                ),
                "fast_review_ocr": FAST_REVIEW_OCR_ENABLED,
            },
            "error_message": error_message,
        }
        return status == "review_required", payload

    payload = {
        "status": status,
        "raw_text": raw_text,
        "ocr_confidence": get_last_ocr_confidence(),
        "field_confidence": {
            "_document": get_last_ocr_confidence(),
        },
        "extracted_fields": extracted_fields,
        "source_payload": {
            "source": "pi-worker-iot-ocr-request",
            "mode": "interactive_camera",
            "request_id": request_id,
            "application_id": application_id,
            "student_id": student_id,
            "student_name": student_name,
            "document_key": document_key,
            "document_type": document_type,
            "document_contract_status": contract.status if contract else "missing",
            "corrected_text": corrected_text,
            "capture_status": CAPTURED,
            "capture_error_code": None,
            "cancelled": False,
            "returncode": 0 if raw_text else 1,
            "generic_ocr_seconds": round(generic_ocr_seconds, 3),
            "processing_seconds": round(
                time.monotonic() - processing_started_at,
                3,
            ),
            "fast_review_ocr": FAST_REVIEW_OCR_ENABLED,
        },
        "error_message": error_message,
    }

    return status == "review_required", payload


def run_scan(request: Dict, status_callback=None) -> Tuple[bool, Dict]:
    request_ref = _safe_request_ref(get_request_id(request))
    document_key = str(request.get("document_key") or "unknown")
    log.info("Starting capture request=%s document=%s", request_ref, document_key)

    workspace = Path("/tmp/smart-pdm") / get_request_id(request)
    workspace.mkdir(parents=True, exist_ok=True)
    camera = CameraController()
    camera.capture_file = str(workspace / "capture.jpg")

    capture_result = run_capture_session(
        camera=camera,
        should_stop=_shutdown_requested.is_set,
        on_status=status_callback,
    )
    if capture_result.status != CAPTURED:
        log.info(
            "Capture finished request=%s status=%s code=%s",
            request_ref,
            capture_result.status,
            capture_result.error_code or "none",
        )
        success, payload = _capture_outcome_payload(request, capture_result)
        payload["_workspace"] = str(workspace)
        return success, payload

    if status_callback:
        status_callback('processing')

    if _is_birth_certificate_job(request):
        success, payload = _run_birth_certificate_scan(request, capture_result.capture_path)
    else:
        success, payload = _run_generic_document_scan(request, capture_result.capture_path)
    payload["_workspace"] = str(workspace)
    return success, payload


def submit_and_verify(api: ApiClient, request_id: str, payload: Dict, request=None) -> bool:
    request_ref = _safe_request_ref(request_id)
    log.info("Submitting result request=%s status=%s", request_ref, payload.get("status"))

    workspace = payload.pop("_workspace", None)
    if payload.get("status") == "review_required":
        candidate = candidate_from_worker_payload(request or {"request_id": request_id}, payload).serialize()
        response = api.submit_result(
            job_id=request_id,
            status="review_required",
            raw_text=candidate["raw_text"],
            extracted_fields={
                "template_id": candidate["template_id"],
                "document_key": candidate["document_key"],
                "fields": candidate["fields"],
                "field_confidence": candidate["field_confidence"],
                "validation_issues": candidate["validation_issues"],
            },
            source_payload=candidate["processing"],
        )
    else:
        response = api.submit_result(
        job_id=request_id,
        status=payload.get("status"),
        raw_text=payload.get("raw_text"),
        ocr_confidence=payload.get("ocr_confidence"),
        extracted_fields=payload.get("extracted_fields"),
        source_payload=payload.get("source_payload"),
        error_message=payload.get("error_message"),
        )

    if not response:
        log.error("Result submission failed request=%s", request_ref)
        return False

    log.info("Result submitted request=%s", request_ref)
    if workspace:
        shutil.rmtree(workspace, ignore_errors=True)
    return True


def main():
    api = ApiClient()
    log.info(
        "Starting Pi IoT OCR worker | poll=%ss | mode=interactive | device=%s",
        POLL_INTERVAL_SECONDS,
        api.device_id,
    )
    last_idle_log = 0.0

    def request_shutdown(_signal_number, _frame) -> None:
        _shutdown_requested.set()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    while not _shutdown_requested.is_set():
        try:
            request = api.get_next_job()

            if not request:
                now = time.time()
                if now - last_idle_log >= 60:
                    log.info("Idle: waiting for OCR request...")
                    last_idle_log = now
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            request_id = get_request_id(request)
            if not request_id:
                log.warning("Request missing request_id; skipping")
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            log.info("Claimed request=%s", _safe_request_ref(request_id))
            log.info(
                "Request received; opening camera preview request=%s",
                _safe_request_ref(request_id),
            )
            def report_status(status):
                if not api.update_status(request_id, status):
                    log.warning(
                        "Lifecycle status update failed request=%s status=%s",
                        _safe_request_ref(request_id),
                        status,
                    )

            _success, payload = run_scan(request, status_callback=report_status)
            submit_and_verify(api, request_id, payload, request=request)

        except KeyboardInterrupt:
            _shutdown_requested.set()
            break
        except Exception:
            log.exception("Unexpected worker error")

        if not _shutdown_requested.is_set():
            time.sleep(POLL_INTERVAL_SECONDS)

    log.info("Worker stopped")


if __name__ == "__main__":
    main()
