#!/usr/bin/env python3
"""
job_worker.py - Pull-based Pi worker for SMaRT-PDM IoT OCR.

Flow:
1. Poll GET /api/pi/iot-ocr/next
2. Claim one pending request
3. Run main.py interactive preview
4. LEFT inside main.py = scan/OCR/save
5. RIGHT inside main.py = cancel
6. Worker reads /tmp/ocr_raw.txt and /tmp/ocr_result.txt
7. Worker submits result to POST /api/pi/iot-ocr/:requestId/result
"""

import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Tuple

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - test/runtime fallback
    def load_dotenv(*_args, **_kwargs):
        return False

from api import ApiClient
from document_contracts import build_extracted_fields, get_contract

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
MAIN_PY = BASE_DIR / "main.py"

POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "1"))
QUEUE_MODE = os.getenv("QUEUE_MODE", "1")
VERBOSE_MAIN = os.getenv("VERBOSE_MAIN", "1") == "1"

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("iot-worker")


def read_text_file(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as file:
            return file.read().strip()
    except FileNotFoundError:
        return ""
    except Exception as exc:
        log.warning("Failed reading %s: %s", path, exc)
        return ""


def clear_tmp_files() -> None:
    for path in ["/tmp/ocr_raw.txt", "/tmp/ocr_result.txt"]:
        try:
            with open(path, "w", encoding="utf-8") as file:
                file.write("")
        except Exception as exc:
            log.warning("Failed clearing %s: %s", path, exc)


def build_document_type(request: Dict) -> str:
    return request.get("document_type") or request.get("document_key") or "Document"


def get_request_id(request: Dict) -> str:
    return str(request.get("request_id") or request.get("id") or "")


def run_scan(request: Dict) -> Tuple[bool, Dict]:
    env = os.environ.copy()
    env["QUEUE_MODE"] = QUEUE_MODE

    request_id = get_request_id(request)
    application_id = str(request.get("application_id") or "")
    student_id = str(request.get("student_id") or "")
    student_name = str(request.get("student_name") or "")
    document_key = str(request.get("document_key") or "")
    document_type = str(build_document_type(request))

    clear_tmp_files()

    command = [
        sys.executable,
        str(MAIN_PY),
        "--application-id",
        application_id,
        "--student-id",
        student_id,
        "--student-name",
        student_name,
        "--document-key",
        document_key,
        "--document-type",
        document_type,
    ]

    log.info("Running scan for request %s", request_id)

    if VERBOSE_MAIN:
        result = subprocess.run(command, cwd=str(BASE_DIR), env=env)
    else:
        result = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    raw_text = read_text_file("/tmp/ocr_raw.txt")
    corrected_text = read_text_file("/tmp/ocr_result.txt")
    was_cancelled = result.returncode == 2
    extracted_fields = build_extracted_fields(document_key, raw_text)
    contract = get_contract(document_key)

    if was_cancelled:
        status = "cancelled"
        error_message = "IoT OCR was cancelled on the Pi."
    elif result.returncode == 0 and raw_text:
        status = "completed"
        error_message = None
    else:
        status = "failed"
        error_message = "OCR scan failed or returned empty raw_text."

    payload = {
        "status": status,
        "raw_text": raw_text,
        "ocr_confidence": 0.99 if raw_text else None,
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
            "cancelled": was_cancelled,
            "returncode": result.returncode,
        },
        "error_message": error_message,
    }

    return status == "completed", payload


def submit_and_verify(api: ApiClient, request_id: str, payload: Dict) -> bool:
    log.info("Submitting result %s (status=%s)", request_id, payload.get("status"))

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
        log.error("Failed submitting result for request %s", request_id)
        return False

    log.info("Result submitted for request %s", request_id)
    return True


def main():
    log.info(
        "Starting Pi IoT OCR worker | poll=%ss | mode=interactive",
        POLL_INTERVAL_SECONDS,
    )

    api = ApiClient()
    last_idle_log = 0.0

    while True:
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

            log.info("Claimed request %s", request_id)
            _success, payload = run_scan(request)
            submit_and_verify(api, request_id, payload)

        except KeyboardInterrupt:
            log.info("Worker stopped by user")
            break
        except Exception:
            log.exception("Unexpected worker error")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
