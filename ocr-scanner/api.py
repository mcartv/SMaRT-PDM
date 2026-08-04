#!/usr/bin/env python3
"""Reliable API transport v3 for the SMaRT-PDM Pi IoT OCR worker."""

from __future__ import annotations

import logging
import os
import socket
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs):
        return False


ENV_PATH = Path(__file__).resolve().with_name(".env")


def _load_colocated_env(path: Path) -> None:
    try:
        lines = path.read_text(
            encoding="utf-8",
            errors="replace",
        ).splitlines()
    except OSError as exc:
        raise RuntimeError(
            f"Unable to read Pi environment file: {path}"
        ) from exc

    for raw_line in lines:
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        os.environ[key] = value


_load_colocated_env(ENV_PATH)
load_dotenv(dotenv_path=ENV_PATH, override=True)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("iot-api")


def _read_machine_identity() -> str:
    for path in (
        Path("/etc/machine-id"),
        Path("/var/lib/dbus/machine-id"),
    ):
        try:
            value = path.read_text(encoding="utf-8").strip()
        except OSError:
            value = ""
        if value:
            return value

    return socket.gethostname().strip() or "unknown-device"


def resolve_device_id(configured_value: Optional[str] = None) -> str:
    raw_value = (
        configured_value
        if configured_value is not None
        else os.getenv("IOT_DEVICE_ID", "")
    )
    normalized = str(raw_value or "").strip()

    if normalized:
        try:
            return str(uuid.UUID(normalized))
        except ValueError as exc:
            raise RuntimeError(
                "IOT_DEVICE_ID must be a valid UUID"
            ) from exc

    return str(
        uuid.uuid5(
            uuid.NAMESPACE_URL,
            "https://smart-pdm.local/iot-device/"
            + _read_machine_identity(),
        )
    )


class ApiClient:
    def __init__(self):
        self.base_url = os.getenv(
            "RENDER_API_BASE_URL",
            "",
        ).strip().rstrip("/")
        self.pi_token = os.getenv("PI_SHARED_TOKEN", "").strip()
        self.device_id = resolve_device_id()
        self.timeout = max(
            10,
            int(os.getenv("HTTP_TIMEOUT_SECONDS", "45")),
        )
        self.session = requests.Session()
        self.session.trust_env = False
        self._last_transport_error_log = 0.0

        if not self.base_url:
            raise RuntimeError(
                f"Missing RENDER_API_BASE_URL in {ENV_PATH}"
            )

        if not self.base_url.startswith("https://"):
            raise RuntimeError(
                "RENDER_API_BASE_URL must use HTTPS"
            )

        if not self.pi_token:
            raise RuntimeError(
                f"Missing PI_SHARED_TOKEN in {ENV_PATH}"
            )

        log.info(
            "Pi API configured | backend=%s | device=%s",
            self.base_url,
            self.device_id,
        )

    def _headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "SMaRT-PDM-Pi-IoT-OCR/3",
            "x-pi-token": self.pi_token,
            "x-pi-device-id": self.device_id,
        }

    def _log_transport_error(
        self,
        operation: str,
        message: str,
    ) -> None:
        now = time.monotonic()
        if now - self._last_transport_error_log >= 10.0:
            log.error("%s failed: %s", operation, message)
            self._last_transport_error_log = now

    @staticmethod
    def _safe_body(response: requests.Response) -> str:
        return " ".join(response.text[:600].split())

    def get_next_job(self) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/api/pi/iot-ocr/next"

        try:
            response = self.session.get(
                url,
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            self._log_transport_error(
                "GET next IoT OCR request",
                str(exc),
            )
            return None

        if response.status_code == 404:
            return None

        if response.status_code >= 400:
            self._log_transport_error(
                "GET next IoT OCR request",
                f"HTTP {response.status_code} "
                f"{self._safe_body(response)}",
            )
            return None

        try:
            payload = response.json()
        except ValueError:
            self._log_transport_error(
                "GET next IoT OCR request",
                "backend returned non-JSON success response",
            )
            return None

        if not isinstance(payload, dict):
            self._log_transport_error(
                "GET next IoT OCR request",
                "backend returned an invalid JSON object",
            )
            return None

        request = payload.get("data")
        if not isinstance(request, dict):
            request = payload if payload.get("request_id") else None

        if not request:
            self._log_transport_error(
                "GET next IoT OCR request",
                "success response did not contain a request",
            )
            return None

        request_id = str(
            request.get("request_id") or ""
        ).strip()
        if not request_id:
            self._log_transport_error(
                "GET next IoT OCR request",
                "claimed request has no request_id",
            )
            return None

        return request

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
        request_id = str(job_id or "").strip()
        url = (
            f"{self.base_url}/api/pi/iot-ocr/"
            f"{request_id}/result"
        )

        payload = {
            "status": status,
            "raw_text": raw_text or "",
            "ocr_confidence": ocr_confidence,
            "extracted_fields": extracted_fields or {},
            "source_payload": source_payload or {},
            "error_message": error_message,
        }

        if (
            payload["status"] == "review_required"
            and isinstance(payload["source_payload"], dict)
            and payload["source_payload"].get("mode")
            in {
                "birth_certificate_pipeline",
                "indigency_structured_pipeline",
            }
            and payload["source_payload"].get(
                "manual_review_required"
            )
            is True
        ):
            payload["source_payload"] = dict(
                payload["source_payload"],
                worker_status="review_required",
            )
            payload["status"] = "completed"

        try:
            response = self.session.post(
                url,
                headers=self._headers(),
                json=payload,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            self._log_transport_error(
                f"POST result for {request_id[:8]}",
                str(exc),
            )
            return None

        if response.status_code >= 400:
            self._log_transport_error(
                f"POST result for {request_id[:8]}",
                f"HTTP {response.status_code} "
                f"{self._safe_body(response)}",
            )
            return None

        try:
            result = response.json()
        except ValueError:
            return {"ok": True}

        return result if isinstance(result, dict) else {"ok": True}
