#!/usr/bin/env python3
"""
api.py - API client for SMaRT-PDM Pi IoT OCR request flow.

Flow:
GET  /api/pi/iot-ocr/next
POST /api/pi/iot-ocr/:requestId/result
"""

import logging
import os
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("iot-api")


class ApiClient:
    def __init__(self):
        self.base_url = os.getenv("RENDER_API_BASE_URL", "").rstrip("/")
        self.pi_token = os.getenv("PI_SHARED_TOKEN", "")
        self.device_id = os.getenv("IOT_DEVICE_ID", "pi-001")
        self.timeout = int(os.getenv("HTTP_TIMEOUT_SECONDS", "60"))

        if not self.base_url:
            raise RuntimeError("Missing RENDER_API_BASE_URL in .env")

        if not self.pi_token:
            raise RuntimeError("Missing PI_SHARED_TOKEN in .env")

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-pi-token": self.pi_token,
            "x-pi-device-id": self.device_id,
        }

    def get_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Backward-compatible method name.
        Fetches one pending IoT OCR request.
        """
        url = f"{self.base_url}/api/pi/iot-ocr/next"

        try:
            response = requests.get(
                url,
                headers=self._headers(),
                timeout=self.timeout,
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()
            data = response.json()

            # Supports either:
            # { data: request }
            # or direct request object
            request = data.get("data") if isinstance(data, dict) else None
            if request:
                return request

            if isinstance(data, dict) and data.get("request_id"):
                return data

            return None

        except requests.RequestException as exc:
            log.error("get_next_job failed: %s", exc)
            return None

    def submit_result(
        self,
        job_id: str,
        status: str,
        raw_text: Optional[str] = None,
        ocr_confidence: Optional[float] = None,
        extracted_fields: Optional[Dict[str, Any]] = None,
        source_payload: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Backward-compatible method name.
        job_id is request_id.
        """
        request_id = job_id
        url = f"{self.base_url}/api/pi/iot-ocr/{request_id}/result"

        payload = {
            "status": status,
            "raw_text": raw_text or "",
            "ocr_confidence": ocr_confidence,
            "extracted_fields": extracted_fields or {},
            "source_payload": source_payload or {},
            "error_message": error_message,
        }

        try:
            response = requests.post(
                url,
                headers=self._headers(),
                json=payload,
                timeout=self.timeout,
            )

            if response.status_code >= 400:
                log.error(
                    "submit_result failed for request %s: %s | %s",
                    request_id,
                    response.status_code,
                    response.text[:600],
                )

            response.raise_for_status()

            try:
                return response.json()
            except ValueError:
                return {"ok": True}

        except requests.RequestException as exc:
            log.error("submit_result failed for request %s: %s", request_id, exc)
            return None
