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
import json
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
from birth_station_calibration import load_birth_station_calibration
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
from extraction.psa_birth_row_cropper import (
    crop_psa_birth_name_rows,
    validate_psa_birth_name_topology,
)
from extraction.psa_birth_row_ocr import extract_psa_birth_row_text
from extraction.psa_birth_row_identity import identify_psa_birth_name_rows
from extraction.psa_form_registration import (
    register_psa_birth_form,
    register_psa_birth_form_grid_envelope,
)
from ocr import extract_text, get_last_ocr_confidence
from pipeline.result_serializer import candidate_from_worker_payload
from pipeline.grade_form_v1 import scan_grade_form
from runtime.worker_state import build_worker_state

WORKER_ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(dotenv_path=WORKER_ENV_PATH, override=True)

POLL_INTERVAL_SECONDS = max(
    0.10,
    float(os.getenv("POLL_INTERVAL_SECONDS", "0.20")),
)
HEARTBEAT_INTERVAL_SECONDS = min(
    0.50,
    max(
        0.25,
        float(os.getenv("IOT_OCR_HEARTBEAT_INTERVAL_SECONDS", "0.50")),
    ),
)
REQUEST_STOPPED_DISPLAY_SECONDS = max(
    0.50,
    float(os.getenv("IOT_OCR_STOPPED_DISPLAY_SECONDS", "1.25")),
)
WORKSPACE_RETENTION_SECONDS = max(
    3600,
    int(os.getenv("IOT_OCR_WORKSPACE_RETENTION_SECONDS", "86400")),
)
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
BIRTH_CAMERA_CAPTURE_WIDTH = max(
    2304,
    int(os.getenv("BIRTH_CAMERA_CAPTURE_WIDTH", "4608")),
)
BIRTH_CAMERA_CAPTURE_HEIGHT = max(
    1296,
    int(os.getenv("BIRTH_CAMERA_CAPTURE_HEIGHT", "2592")),
)
BIRTH_RELAXED_REGISTRATION_CONFIG = {
    # Birth-only recovery for the fixed physical scanner station. The normal
    # strict registration always runs first. These tolerances still require a
    # detected PSA grid and the registration module's post-warp row/column
    # topology checks before calibrated name cells may be read.
    "review_horizontal_lines": 5,
    "review_vertical_lines": 2,
    "boundary_search_distance": 0.14,
    "line_cluster_distance": 0.009,
    "review_corner_deviation": 0.09,
    "maximum_extended_corner_deviation": 0.13,
    "review_opposite_edge_ratio": 1.35,
    "review_canonical_edge_deviation": 0.03,
    "registered_line_minimum_coverage": 0.16,
}

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("iot-worker")
_shutdown_requested = threading.Event()
RUNTIME_UID = getattr(os, "getuid", lambda: 0)()
WORKER_ACTIVITY_PATH = Path(
    os.getenv(
        "SMART_PDM_OCR_ACTIVITY_PATH",
        f"/run/user/{RUNTIME_UID}/smart_pdm/worker_activity.json",
    )
)
_state_sequence = 0


def publish_worker_activity(state: str, *, request=None, camera_status="unknown") -> None:
    global _state_sequence
    _state_sequence += 1
    request = request or {}
    snapshot = build_worker_state(
        sequence=_state_sequence,
        worker_state=state,
        request_reference=get_request_id(request),
        application_reference=request.get("application_id"),
        document_key=request.get("document_key"),
        camera_status=camera_status,
    ).to_dict()
    try:
        WORKER_ACTIVITY_PATH.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = WORKER_ACTIVITY_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(snapshot), encoding="utf-8")
        os.chmod(temporary, 0o600)
        os.replace(temporary, WORKER_ACTIVITY_PATH)
    except OSError:
        log.warning("Unable to publish local OCR worker state")


def lifecycle_worker_state(status: str) -> tuple[str, str]:
    return {
        "claimed": ("request_claimed", "checking"),
        "previewing": ("waiting_for_capture", "preview_active"),
        "focusing": ("capturing", "capture_in_progress"),
        "capturing": ("capturing", "capture_in_progress"),
        "processing": ("running_ocr", "captured"),
    }.get(status, ("idle", "ready"))


def clear_tmp_files() -> None:
    for path in ["/tmp/ocr_raw.txt", "/tmp/ocr_result.txt"]:
        try:
            with open(path, "w", encoding="utf-8") as file:
                file.write("")
        except Exception as exc:
            log.warning("Failed clearing %s: %s", path, exc)


def cleanup_expired_workspaces(now: float | None = None) -> int:
    root = Path("/tmp/smart-pdm")
    if not root.exists():
        return 0
    cutoff = (time.time() if now is None else now) - WORKSPACE_RETENTION_SECONDS
    removed = 0
    for directory in root.iterdir():
        try:
            if directory.is_dir() and directory.stat().st_mtime < cutoff:
                shutil.rmtree(directory, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed


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
        ("residency_address", "Full Address"),
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


def _birth_topology_summary(topology: Any) -> Dict[str, Any]:
    if not isinstance(topology, dict) and not hasattr(topology, "items"):
        return {}
    summary: Dict[str, Any] = {}
    for name, row in topology.items():
        boundaries = getattr(row, "component_boundaries", None)
        top = getattr(row, "top", None)
        bottom = getattr(row, "bottom", None)
        if (
            not isinstance(name, str)
            or not isinstance(boundaries, tuple)
            or len(boundaries) != 4
            or not all(isinstance(value, int) for value in boundaries)
            or not isinstance(top, int)
            or not isinstance(bottom, int)
        ):
            continue
        summary[name] = {
            "top": top,
            "bottom": bottom,
            "component_boundaries": list(boundaries),
            "evidence_status": str(getattr(row, "evidence_status", "matched")),
        }
    return summary


def _run_birth_diagnostic_ocr(source_image: Any) -> str:
    """Return exact unstructured Tesseract output for review evidence only."""

    if source_image is None:
        return ""
    try:
        return str(pytesseract.image_to_string(
            source_image,
            config="--oem 3 --psm 6 -l eng",
            timeout=30.0,
        ) or "")
    except Exception:
        return ""


def _birth_diagnostic_review_payload(
    request: Dict,
    source_image: Any,
    *,
    issue_code: str,
    issue_message: str,
    source_updates: Dict[str, Any] | None = None,
) -> Tuple[bool, Dict]:
    raw_text = _run_birth_diagnostic_ocr(source_image)
    has_text = bool(raw_text.strip())
    status = "review_required" if has_text else "failed"
    source_payload = {
        "source": "pi-worker-iot-ocr-request",
        "mode": "birth_certificate_pipeline",
        "request_id": get_request_id(request),
        "document_key": str(request.get("document_key") or ""),
        "document_type": str(build_document_type(request)),
        "document_contract_status": "approved",
        "registration_status": "mismatch",
        "topology_status": "unknown",
        "row_identity_status": "unknown",
        "cropper_status": "not_started",
        "ocr_status": "diagnostic_only" if has_text else "failed",
        "raw_text_mode": "diagnostic_full_page_tesseract",
        "structured_value_source": "none",
        "diagnostic_only": True,
        "manual_review_required": True,
        "worker_status": status,
        "structured_field_keys": [],
    }
    source_payload.update(source_updates or {})
    return has_text, {
        "status": status,
        "raw_text": raw_text,
        "ocr_confidence": None,
        "field_confidence": {},
        "document_type": "birth_certificate",
        "manual_review_required": True,
        "ocr_attempts": 1 if has_text else 0,
        "preprocessing_variant": "diagnostic_full_page_tesseract",
        "extracted_fields": _empty_birth_extracted_fields(),
        "source_payload": source_payload,
        "validation_issues": [{
            "code": issue_code,
            "message": issue_message,
        }],
        "error_message": None if has_text else issue_message,
    }


def _run_birth_certificate_scan(
    request: Dict,
    capture_path: str,
    request_stop=None,
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
        registration_mode = "strict_grid"
        registration_attempts = 1
        registration_result = register_psa_birth_form(source_image)
        if not registration_result.success:
            registration_attempts += 1
            relaxed_result = register_psa_birth_form(
                source_image,
                config=BIRTH_RELAXED_REGISTRATION_CONFIG,
            )
            if relaxed_result.success:
                registration_result = relaxed_result
                registration_mode = "relaxed_validated_grid"
        if not registration_result.success:
            registration_attempts += 1
            envelope_result = register_psa_birth_form_grid_envelope(source_image)
            registration_result = envelope_result
            registration_mode = "validated_grid_envelope"
            if envelope_result.success:
                registration_result = envelope_result
        if not registration_result.success:
            return _birth_diagnostic_review_payload(
                request,
                source_image,
                issue_code="PSA_BIRTH_V1_TEMPLATE_MISMATCH",
                issue_message="Approved birth certificate template registration failed.",
                source_updates={
                    "registration_status": "mismatch",
                    "registration_stage_status": registration_result.status,
                    "registration_mode": registration_mode,
                    "registration_attempts": registration_attempts,
                    "registration_issue_codes": _issue_codes(registration_result),
                },
            )

        cropper_config, calibration_metadata = load_birth_station_calibration()
        topology_result = validate_psa_birth_name_topology(
            registration_result.data.registered_image,
            config=cropper_config,
        )
        if not topology_result.success or topology_result.data is None:
            return _birth_diagnostic_review_payload(
                request,
                source_image,
                issue_code="PSA_BIRTH_NAME_TOPOLOGY_MISMATCH",
                issue_message="Items 1, 6, and 13 could not use calibrated PSA row geometry.",
                source_updates={
                    "registration_status": registration_result.status,
                    "registration_mode": registration_mode,
                    "topology_status": "mismatch",
                    "topology_issue_codes": _issue_codes(topology_result),
                    "calibration": calibration_metadata,
                },
            )

        identity_result = identify_psa_birth_name_rows(
            registration_result.data.registered_image,
            topology_result.data,
        )
        if not identity_result.success:
            return _birth_diagnostic_review_payload(
                request,
                source_image,
                issue_code="PSA_BIRTH_ROW_LABEL_CONFLICT",
                issue_message="A calibrated Birth row matched a different printed item.",
                source_updates={
                    "registration_status": registration_result.status,
                    "registration_mode": registration_mode,
                    "topology_status": topology_result.metrics.get(
                        "topology_status", topology_result.status
                    ),
                    "topology_issue_codes": _issue_codes(topology_result),
                    "row_identity_status": "conflict",
                    "row_identity_issue_codes": _issue_codes(identity_result),
                    "calibration": calibration_metadata,
                },
            )

        crop_kwargs = {
            "registration_metadata": _registration_context(registration_result),
            "topology": topology_result.data,
        }
        if cropper_config:
            crop_kwargs["config"] = cropper_config
        crop_result = crop_psa_birth_name_rows(
            registration_result.data.registered_image,
            **crop_kwargs,
        )
        if not crop_result.success:
            return _birth_diagnostic_review_payload(
                request,
                source_image,
                issue_code="PSA_BIRTH_NAME_CROPPER_FAILED",
                issue_message="The calibrated Birth name cells could not be cropped safely.",
                source_updates={
                    "registration_status": registration_result.status,
                    "registration_mode": registration_mode,
                    "topology_status": topology_result.metrics.get(
                        "topology_status", topology_result.status
                    ),
                    "row_identity_status": identity_result.status,
                    "cropper_status": crop_result.status,
                    "cropper_issue_codes": _issue_codes(crop_result),
                    "calibration": calibration_metadata,
                },
            )

        ocr_result = extract_psa_birth_row_text(crop_result.data)
        ocr_field_texts = {
            field.name: {
                "raw_text": field.raw_text,
                "components": dict(field.components),
                "section_status": field.section_status,
                "confidence": field.confidence,
                "component_confidence": dict(field.component_confidence),
                "component_raw_text": dict(field.component_raw_text),
            }
            for field in getattr(ocr_result.data, "fields", ())
        }
        raw_text = "\n".join(
            "\t".join(
                str(
                    (ocr_field_texts.get(field_name, {}).get("component_raw_text") or {})
                    .get(component_name, "")
                    or ""
                )
                for component_name in ("first_name", "middle_name", "last_name")
            )
            for field_name in ("child_name", "mother_maiden_name", "father_name")
        )
        extracted_fields = build_birth_extracted_fields_from_ocr_result(
            raw_text=raw_text,
            field_texts=ocr_field_texts,
            ocr_attempts=int(ocr_result.metrics.get("total_ocr_attempts", 27)),
            preprocessing_variant=(
                ocr_result.data.fields[0].preprocessing_variant
                if getattr(ocr_result.data, "fields", ())
                else preprocessing_variant
            ),
        )
        structured_text = extracted_fields["raw_text"]
        ocr_attempts = int(extracted_fields["ocr_attempts"])
        preprocessing_variant = str(extracted_fields["preprocessing_variant"])
        structured_ready = ocr_result.success
        if not structured_ready:
            return _birth_diagnostic_review_payload(
                request,
                source_image,
                issue_code="OCR_REQUIRED_BIRTH_NAMES_NOT_FOUND",
                issue_message="Child and mother first/last names were not both detected.",
                source_updates={
                    "registration_status": registration_result.status,
                    "registration_mode": registration_mode,
                    "topology_status": topology_result.metrics.get(
                        "topology_status", topology_result.status
                    ),
                    "topology_issue_codes": _issue_codes(topology_result),
                    "row_identity_status": identity_result.status,
                    "row_identity_issue_codes": _issue_codes(identity_result),
                    "cropper_status": crop_result.status,
                    "ocr_issue_codes": _issue_codes(ocr_result),
                    "calibration": calibration_metadata,
                },
            )
        status = "review_required"
        error_message = None

        payload = {
            "status": status,
            "raw_text": raw_text,
            "ocr_confidence": None,
            "field_confidence": {
                field_name: value.get("confidence")
                for field_name, value in ocr_field_texts.items()
            },
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
                "registration_mode": registration_mode,
                "registration_attempts": registration_attempts,
                "registration_issue_codes": _issue_codes(registration_result),
                "topology_status": topology_result.metrics.get(
                    "topology_status", topology_result.status
                ),
                "topology_issue_codes": _issue_codes(topology_result),
                "topology_validated_row_count": topology_result.metrics.get(
                    "validated_row_count", 0
                ),
                "topology_rows": _birth_topology_summary(topology_result.data),
                "row_identity_status": identity_result.status,
                "row_identity_issue_codes": _issue_codes(identity_result),
                "row_identity_rows": identity_result.metrics.get("row_status", {}),
                "calibration": calibration_metadata,
                "confidence_source": ocr_result.metrics.get(
                    "confidence_source",
                    "tesseract_image_to_data_three_variant_vote",
                ),
                "paddle_enabled": False,
                "manual_entry_status": "disabled",
                "structured_value_source": "birth_nine_cell_tesseract_vote",
                "raw_text_mode": "nine_cell_selected_observations",
                "variant_observations": ocr_result.metrics.get(
                    "variant_observations", {}
                ),
                "structured_text_available": bool(structured_text.strip()),
                "cropper_status": crop_result.status,
                "cropper_issue_codes": _issue_codes(crop_result),
                "ocr_status": ocr_result.status,
                "ocr_issue_codes": _issue_codes(ocr_result),
                "manual_review_required": True,
                "worker_status": status,
                "ocr_attempts": ocr_attempts,
                "preprocessing_variant": preprocessing_variant,
                "structured_field_keys": sorted(ocr_field_texts),
            },
            "validation_issues": [
                {
                    "code": str(issue.get("code") or "BIRTH_OCR_REVIEW"),
                    "message": "Birth certificate OCR requires admin review.",
                }
                for issue in getattr(ocr_result, "issues", ())
            ],
            "error_message": error_message,
        }
        return status == "review_required", payload
    except Exception:
        return _birth_diagnostic_review_payload(
            request,
            source_image,
            issue_code="BIRTH_PIPELINE_FAILED",
            issue_message=(
                "Birth structured extraction failed. The unstructured raw snapshot "
                "is available for review only."
            ),
            source_updates={
                "registration_status": "failed",
                "registration_issue_codes": ["BIRTH_PIPELINE_FAILED"],
                "cropper_status": "not_started",
                "cropper_issue_codes": [],
                "ocr_status": "diagnostic_only",
                "ocr_issue_codes": ["BIRTH_PIPELINE_FAILED"],
            },
        )


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
    indigency_job = _is_indigency_job(request)
    if indigency_job:
        # The structured extractor already performs one full-page image_to_data
        # pass and builds the immutable raw snapshot from those same fields.
        # Avoid a second whole-page Tesseract pass for the same capture.
        raw_text = ""
        corrected_text = ""
        generic_ocr_seconds = 0.0
    else:
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
    if indigency_job:
        status = "processing"
        error_message = None
    elif raw_text:
        status = "review_required"
        error_message = None
    else:
        status = "failed"
        error_message = "OCR scan failed or returned empty raw_text."

    if indigency_job:
        extraction_result = None
        extraction_status = "not_started"
        extraction_issue_codes: list[str] = []
        extraction_seconds = 0.0
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
                        include_optional_fields=False,
                    ),
                )
                extraction_seconds = time.monotonic() - extraction_started_at
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

        page_raw_text = str(
            getattr(getattr(extraction_result, "data", None), "raw_text", "")
            or ""
        ).strip()
        extracted_fields = build_indigency_extracted_fields_from_result(
            page_raw_text,
            extraction_result,
        )
        structured_raw_text = _build_indigency_structured_raw_text(
            extracted_fields
        )

        if structured_raw_text:
            raw_text = page_raw_text
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
        registration_status = (
            "matched"
            if extraction_result is not None
            and bool(getattr(extraction_result, "success", False))
            and extraction_status == "review_required"
            else "mismatch"
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
                "returncode": 0 if structured_raw_text else 1,
                "ocr_status": extraction_status,
                "registration_status": registration_status,
                "ocr_issue_codes": extraction_issue_codes,
                "manual_review_required": True,
                "worker_status": status,
                "preprocessing_variant": preprocessing_variant,
                "structured_field_keys": sorted(
                    extracted_fields.get("fields", {}).keys()
                ),
                "raw_text_mode": "tesseract_page_words",
                "structured_raw_text_consistent": bool(structured_raw_text),
                "generic_page_text_persisted": bool(raw_text),
                "generic_ocr_skipped": True,
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


def _run_grade_form_scan(request: Dict, capture_path: str) -> Tuple[bool, Dict]:
    """Run one preprocessed Tesseract pass and reuse it for registration/fields."""
    request_id = get_request_id(request)
    started_at = time.monotonic()
    try:
        result = scan_grade_form(capture_path)
    except Exception:
        log.exception(
            "Grade form OCR failed request=%s",
            _safe_request_ref(request_id),
        )
        result = None

    matched = bool(result and result.matched)
    has_ocr_text = bool(result and str(result.raw_text or "").strip())
    # A registration mismatch is still a valid machine-generated review
    # candidate. Returning it lets the admin inspect the immutable raw OCR and
    # correct any safely derived fields instead of silently losing the scan.
    review_candidate_ready = bool(result and (matched or has_ocr_text))
    status = "review_required" if review_candidate_ready else "failed"
    elapsed = time.monotonic() - started_at
    log.info(
        "Grade form OCR finished request=%s status=%s seconds=%.1f",
        _safe_request_ref(request_id),
        status,
        elapsed,
    )
    return review_candidate_ready, {
        "status": status,
        "raw_text": result.raw_text if result else "",
        "field_confidence": result.field_confidence if result else {},
        "validation_issues": result.validation_issues if result else [{
            "code": "GRADE_FORM_OCR_FAILED",
            "message": "Grade form OCR did not complete.",
        }],
        "extracted_fields": {
            "document_type": "student_grade_forms",
            "review_required": True,
            "contract_status": "approved" if matched else "mismatch",
            "fields": result.fields if result else {},
        },
        "source_payload": {
            "source": "pi-worker-iot-ocr-request",
            "mode": "grade_form_registered_single_pass",
            "request_id": request_id,
            "document_key": "student_grade_forms",
            "registration_status": "matched" if matched else "mismatch",
            "preprocessing_variant": "grade_form_v1",
            "ocr_engine": "tesseract",
            "processing_seconds": round(elapsed, 3),
        },
        "error_message": None if review_candidate_ready else "Grade form OCR did not return text.",
    }


def _configure_camera_for_document(camera: CameraController, document_key: str) -> None:
    if document_key == "student_grade_forms":
        camera.focus_mode = "continuous"
    elif _is_birth_certificate_job({"document_key": document_key}):
        camera.focus_mode = "continuous"
        camera.capture_profile = "psa_birth_v1"
        camera.capture_width = BIRTH_CAMERA_CAPTURE_WIDTH
        camera.capture_height = BIRTH_CAMERA_CAPTURE_HEIGHT


def run_scan(request: Dict, status_callback=None, request_stop=None) -> Tuple[bool, Dict]:
    request_ref = _safe_request_ref(get_request_id(request))
    document_key = str(request.get("document_key") or "unknown")
    log.info("Starting capture request=%s document=%s", request_ref, document_key)

    workspace = Path("/tmp/smart-pdm") / get_request_id(request)
    workspace.mkdir(parents=True, exist_ok=True)
    camera = CameraController()
    _configure_camera_for_document(camera, document_key)
    camera.capture_file = str(workspace / "capture.jpg")

    capture_result = run_capture_session(
        camera=camera,
        should_stop=lambda: _shutdown_requested.is_set() or bool(request_stop and request_stop.is_set()),
        on_status=status_callback,
    )
    if request_stop and request_stop.is_set():
        log.info("Request stopped by backend request=%s", request_ref)
        return False, {"status": "cancelled", "_workspace": str(workspace)}
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

    if request_stop and request_stop.is_set():
        return False, {"status": "cancelled", "_workspace": str(workspace)}
    publish_worker_activity(
        "preprocessing",
        request=request,
        camera_status="captured",
    )
    if status_callback:
        status_callback('processing')

    if request_stop and request_stop.is_set():
        return False, {"status": "cancelled", "_workspace": str(workspace)}

    publish_worker_activity(
        "running_ocr",
        request=request,
        camera_status="captured",
    )

    if _is_birth_certificate_job(request):
        success, payload = _run_birth_certificate_scan(
            request,
            capture_result.capture_path,
            request_stop=request_stop,
        )
    elif document_key == "student_grade_forms":
        success, payload = _run_grade_form_scan(request, capture_result.capture_path)
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
    publish_worker_activity("idle", camera_status="ready")
    removed_workspaces = cleanup_expired_workspaces()
    if removed_workspaces:
        log.info("Expired OCR workspaces removed count=%s", removed_workspaces)
    log.info(
        "Starting Pi IoT OCR worker | poll=%ss | mode=interactive | device=%s",
        POLL_INTERVAL_SECONDS,
        api.device_id,
    )
    last_idle_log = 0.0
    last_connectivity_publish = 0.0
    last_workspace_cleanup = time.time()

    def request_shutdown(_signal_number, _frame) -> None:
        _shutdown_requested.set()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    while not _shutdown_requested.is_set():
        try:
            now = time.time()
            if now - last_workspace_cleanup >= 3600:
                cleanup_expired_workspaces(now)
                last_workspace_cleanup = now
            request = api.get_next_job()

            if not request:
                now = time.time()
                if now - last_connectivity_publish >= 5:
                    if api.backend_online:
                        publish_worker_activity("idle", camera_status="ready")
                    else:
                        publish_worker_activity("backend_offline", camera_status="unavailable")
                    last_connectivity_publish = now
                if now - last_idle_log >= 60:
                    log.info("Idle: waiting for OCR request...")
                    last_idle_log = now
                _shutdown_requested.wait(POLL_INTERVAL_SECONDS)
                continue

            request_id = get_request_id(request)
            if not request_id:
                log.warning("Request missing request_id; skipping")
                _shutdown_requested.wait(POLL_INTERVAL_SECONDS)
                continue

            log.info("Claimed request=%s", _safe_request_ref(request_id))
            publish_worker_activity("request_claimed", request=request, camera_status="checking")
            log.info(
                "Request received; opening camera preview request=%s",
                _safe_request_ref(request_id),
            )
            heartbeat_stop = threading.Event()
            request_stop = threading.Event()
            current_status = {"value": "claimed"}
            status_update_lock = threading.Lock()

            def report_status(status):
                with status_update_lock:
                    if request_stop.is_set():
                        return False
                    current_status["value"] = status
                    worker_state, camera_status = lifecycle_worker_state(status)
                    publish_worker_activity(worker_state, request=request, camera_status=camera_status)
                    if not api.update_status(request_id, status):
                        log.warning(
                            "Lifecycle status update failed request=%s status=%s",
                            _safe_request_ref(request_id),
                            status,
                        )
                        request_stop.set()
                        publish_worker_activity("request_stopped", request=request, camera_status="stopped")
                        return False
                    return True

            def send_heartbeat():
                # Use an independent HTTP session. requests.Session is not
                # guaranteed to be thread-safe, and camera status callbacks
                # can otherwise contend with this lease-renewal path.
                heartbeat_api = ApiClient()
                while not heartbeat_stop.wait(HEARTBEAT_INTERVAL_SECONDS):
                    heartbeat_failed = False
                    failed_status = None
                    with status_update_lock:
                        if heartbeat_stop.is_set() or request_stop.is_set():
                            break
                        heartbeat_status = current_status["value"]
                        worker_state, camera_status = lifecycle_worker_state(heartbeat_status)
                        publish_worker_activity(worker_state, request=request, camera_status=camera_status)
                        if not heartbeat_api.update_status(request_id, heartbeat_status):
                            heartbeat_failed = True
                            failed_status = heartbeat_status
                            request_stop.set()
                            publish_worker_activity("request_stopped", request=request, camera_status="stopped")
                    if heartbeat_failed:
                        log.warning(
                            "Lifecycle heartbeat failed request=%s status=%s",
                            _safe_request_ref(request_id),
                            failed_status,
                        )
                        while not heartbeat_stop.wait(5):
                            publish_worker_activity(
                                "request_stopped",
                                request=request,
                                camera_status="stopped",
                            )
                        break

            heartbeat_thread = threading.Thread(
                target=send_heartbeat,
                name=f"iot-ocr-heartbeat-{request_id[:8]}",
                daemon=True,
            )
            heartbeat_thread.start()
            try:
                # Capture still starts directly after claim: run_scan(request).
                _success, payload = run_scan(
                    request,
                    status_callback=report_status,
                    request_stop=request_stop,
                )
                if not request_stop.is_set():
                    publish_worker_activity(
                        "submitting_result",
                        request=request,
                        camera_status="captured",
                    )
                    submitted = submit_and_verify(
                        api,
                        request_id,
                        payload,
                        request=request,
                    )
                    if submitted:
                        publish_worker_activity(
                            "completed",
                            request=request,
                            camera_status="captured",
                        )
            finally:
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=1.0)
                if request_stop.is_set() and not _shutdown_requested.is_set():
                    publish_worker_activity(
                        "request_stopped",
                        request=request,
                        camera_status="stopped",
                    )
                    _shutdown_requested.wait(REQUEST_STOPPED_DISPLAY_SECONDS)
                publish_worker_activity("idle", camera_status="ready")

        except KeyboardInterrupt:
            _shutdown_requested.set()
            break
        except Exception:
            log.exception("Unexpected worker error")

        if not _shutdown_requested.is_set():
            _shutdown_requested.wait(POLL_INTERVAL_SECONDS)

    publish_worker_activity("stopping", camera_status="stopped")
    log.info("Worker stopped")


if __name__ == "__main__":
    main()
