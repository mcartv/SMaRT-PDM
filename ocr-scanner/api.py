#!/usr/bin/env python3
"""Reliable API transport v3 for the SMaRT-PDM Pi IoT OCR worker."""

from __future__ import annotations

import logging
import os
import hashlib
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
        self.backend_online = False

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
            self.backend_online = False
            self._log_transport_error(
                "GET next IoT OCR request",
                str(exc),
            )
            return None

        if response.status_code == 404:
            self.backend_online = True
            return None

        if response.status_code >= 400:
            self.backend_online = False
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

        self.backend_online = True

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

    def update_status(self, request_id: str, status: str) -> bool:
        """Persist one active request lifecycle transition with retries."""
        url = f"{self.base_url}/api/pi/iot-ocr/{request_id}/status"

        for attempt in range(1, 4):
            try:
                response = self.session.post(
                    url,
                    headers=self._headers(),
                    json={"status": status},
                    timeout=min(self.timeout, 10),
                )
                if response.status_code in {400, 404, 409, 410}:
                    log.warning(
                        "Lifecycle request rejected request=%s status=%s http=%s",
                        request_id[:8],
                        status,
                        response.status_code,
                    )
                    return False
                response.raise_for_status()
                return True
            except requests.RequestException as exc:
                log.warning(
                    "update_status attempt %s failed request=%s status=%s: %s",
                    attempt,
                    request_id[:8],
                    status,
                    exc,
                )

        return False

    def submit_result(
        self,
        job_id: str,
        status: str,
        raw_text: Optional[str] = None,
        ocr_confidence: Optional[float] = None,
        extracted_fields: Optional[Dict[str, Any]] = None,
        source_payload: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        error_code: Optional[str] = None,
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
            "error_code": error_code,
        }

        if payload["status"] == "review_required":
            structured = payload["extracted_fields"]
            payload.update({
                "document_key": structured.get("document_key"),
                "template_id": structured.get("template_id", "unknown"),
                "fields": structured.get("fields", {}),
                "field_confidence": structured.get("field_confidence", {}),
                "validation_issues": structured.get("validation_issues", []),
                "review_required": True,
                "processing": payload["source_payload"],
            })

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

    def authorize_birth_v2_uploads(
        self,
        request_id: str,
        artifacts: list[dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/api/pi/iot-ocr/{request_id}/capture-artifacts/authorize"
        try:
            response = self.session.post(
                url,
                headers=self._headers(),
                json={"artifacts": artifacts},
                timeout=self.timeout,
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("data") if isinstance(payload, dict) else None
        except (requests.RequestException, ValueError) as exc:
            self._log_transport_error(
                f"Authorize Birth V2 uploads for {request_id[:8]}",
                str(exc),
            )
            return None

    def upload_signed_artifact(
        self,
        authorization: dict[str, Any],
        content: bytes,
        mime_type: str,
    ) -> bool:
        signed_url = str(authorization.get("signed_url") or "").strip()
        if not signed_url:
            return False
        try:
            response = self.session.put(
                signed_url,
                headers={
                    "Content-Type": mime_type,
                    "Cache-Control": "max-age=0",
                    "x-upsert": "true",
                },
                data=content,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return True
        except requests.RequestException as exc:
            self._log_transport_error(
                "Upload private Birth V2 artifact",
                f"transport_error={type(exc).__name__}",
            )
            return False

    def submit_birth_v2_artifacts(
        self,
        request_id: str,
        artifacts: list[dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        manifest = []
        by_slot: dict[tuple[str, str], dict[str, Any]] = {}
        for artifact in artifacts:
            content = bytes(artifact["content"])
            item = {
                "artifact_kind": artifact["artifact_kind"],
                "cell_key": artifact.get("cell_key"),
                "mime_type": artifact["mime_type"],
                "byte_count": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "roi_polygon": artifact.get("roi_polygon"),
            }
            manifest.append(item)
            by_slot[(item["artifact_kind"], item.get("cell_key") or "")] = {
                **item,
                "content": content,
            }
        authorized = self.authorize_birth_v2_uploads(request_id, manifest)
        if not authorized:
            return None
        upload_items = authorized.get("artifacts") or []
        if len(upload_items) != len(manifest):
            return None
        for authorization in upload_items:
            slot = (
                str(authorization.get("artifact_kind") or ""),
                str(authorization.get("cell_key") or ""),
            )
            local = by_slot.get(slot)
            if not local or not self.upload_signed_artifact(
                authorization,
                local["content"],
                local["mime_type"],
            ):
                return None
        url = f"{self.base_url}/api/pi/iot-ocr/{request_id}/capture-artifacts/complete"
        try:
            response = self.session.post(
                url,
                headers=self._headers(),
                json={},
                timeout=max(self.timeout, 45),
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("data") if isinstance(payload, dict) else None
        except (requests.RequestException, ValueError) as exc:
            self._log_transport_error(
                f"Complete Birth V2 extraction for {request_id[:8]}",
                str(exc),
            )
            return None
