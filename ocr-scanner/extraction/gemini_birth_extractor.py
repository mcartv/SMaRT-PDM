"""Birth-only Gemini extraction for the nine calibrated PSA name cells.

The module deliberately has no dependency on the Grade Form or Indigency
pipelines. Images are sent inline and are never uploaded through the Files API.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Mapping

import cv2
import numpy as np


TEMPLATE_ID = "psa_birth_v1"
MODEL_DEFAULT = "gemini-2.5-flash"
FIELD_KEYS = (
    "child_first_name",
    "child_middle_name",
    "child_last_name",
    "mothers_maiden_first",
    "mothers_maiden_middle",
    "mothers_maiden_last",
    "father_first_name",
    "father_middle_name",
    "father_last_name",
)
CELL_KEYS = (
    "child_name.first_name",
    "child_name.middle_name",
    "child_name.last_name",
    "mother_maiden_name.first_name",
    "mother_maiden_name.middle_name",
    "mother_maiden_name.last_name",
    "father_name.first_name",
    "father_name.middle_name",
    "father_name.last_name",
)
CELL_LABELS = (
    "PSA Item 1 Child First Name",
    "PSA Item 1 Child Middle Name",
    "PSA Item 1 Child Last Name",
    "PSA Item 6 Mother Maiden First Name",
    "PSA Item 6 Mother Maiden Middle Name",
    "PSA Item 6 Mother Maiden Last Name",
    "PSA Item 13 Father First Name",
    "PSA Item 13 Father Middle Name",
    "PSA Item 13 Father Last Name",
)
RESPONSE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["template_id", "fields"],
    "properties": {
        "template_id": {"type": "string", "enum": [TEMPLATE_ID]},
        "fields": {
            "type": "object",
            "additionalProperties": False,
            "required": list(FIELD_KEYS),
            "properties": {key: {"type": "string"} for key in FIELD_KEYS},
        },
    },
}
PROMPT = """You are an expert at extracting structured data from Philippine
Certificates of Live Birth. The following nine images are calibrated physical
cells from PSA Items 1, 6, and 13. Each image is preceded by its exact cell
label. Transcribe only the text printed or typed inside that cell. Preserve
compound names, spaces, hyphens, apostrophes, and periods. Do not infer,
correct, or invent a name. If a cell is blank or not clearly legible, return an
empty string. Return only the schema-constrained JSON object."""


@dataclass(frozen=True)
class GeminiBirthResult:
    success: bool
    fields: Mapping[str, str] = field(
        default_factory=lambda: MappingProxyType({})
    )
    enabled: bool = False
    model: str = MODEL_DEFAULT
    error_code: str = ""


def _enabled(value: str | None = None) -> bool:
    raw = os.getenv("USE_GEMINI", "false") if value is None else value
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def _safe_timeout(value: Any) -> float:
    try:
        return min(60.0, max(1.0, float(value)))
    except (TypeError, ValueError):
        return 20.0


def _normalize_cell_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _not_applicable(value: str) -> bool:
    return re.sub(r"[^A-Z]", "", value.upper()) == "NA"


def _validate_payload(payload: Any) -> Mapping[str, str]:
    if not isinstance(payload, dict) or set(payload) != {"template_id", "fields"}:
        raise ValueError("schema")
    if payload.get("template_id") != TEMPLATE_ID:
        raise ValueError("template")
    fields = payload.get("fields")
    if not isinstance(fields, dict) or set(fields) != set(FIELD_KEYS):
        raise ValueError("schema")
    if any(not isinstance(fields[key], str) for key in FIELD_KEYS):
        raise ValueError("schema")
    normalized = {key: _normalize_cell_text(fields[key]) for key in FIELD_KEYS}
    for key in (
        "child_first_name",
        "child_last_name",
        "mothers_maiden_first",
        "mothers_maiden_last",
    ):
        if not normalized[key] or _not_applicable(normalized[key]):
            raise ValueError("required_names")
    father_values = [normalized[key] for key in FIELD_KEYS[-3:]]
    father_na = [value for value in father_values if value and _not_applicable(value)]
    father_names = [value for value in father_values if value and not _not_applicable(value)]
    if father_na and father_names:
        raise ValueError("father_conflict")
    return MappingProxyType(normalized)


def _encode_crop(crop: Any) -> bytes:
    if not isinstance(crop, np.ndarray) or crop.size == 0:
        raise ValueError("crop")
    success, encoded = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise ValueError("crop")
    return encoded.tobytes()


def _error_code(exc: Exception) -> str:
    if isinstance(exc, ImportError):
        return "SDK_UNAVAILABLE"
    if isinstance(exc, json.JSONDecodeError):
        return "INVALID_JSON"
    if isinstance(exc, ValueError):
        reason = str(exc)
        return {
            "crop": "INVALID_CROPS",
            "schema": "INVALID_SCHEMA",
            "template": "TEMPLATE_MISMATCH",
            "required_names": "INCOMPLETE_REQUIRED_NAMES",
            "father_conflict": "FATHER_NAME_CONFLICT",
        }.get(reason, "INVALID_RESPONSE")
    name = type(exc).__name__.upper()
    if "TIMEOUT" in name:
        return "TIMEOUT"
    return "API_ERROR"


def _load_sdk() -> tuple[Any, Any]:
    from google import genai
    from google.genai import types

    return genai, types


def extract_with_gemini(
    crops: Mapping[str, np.ndarray],
    *,
    enabled: bool | None = None,
    api_key: str | None = None,
    model: str | None = None,
    timeout_seconds: float | None = None,
    client: Any = None,
) -> GeminiBirthResult:
    """Extract nine Birth name cells without exposing image or text in errors."""

    use_gemini = _enabled() if enabled is None else bool(enabled)
    selected_model = (
        str(model or os.getenv("GEMINI_MODEL") or MODEL_DEFAULT).strip()
        or MODEL_DEFAULT
    )
    if not use_gemini:
        return GeminiBirthResult(False, enabled=False, model=selected_model, error_code="DISABLED")
    key = str(api_key or os.getenv("GEMINI_API_KEY") or "").strip()
    if not key:
        return GeminiBirthResult(False, enabled=True, model=selected_model, error_code="KEY_MISSING")
    owns_client = False
    try:
        if set(crops) != set(CELL_KEYS):
            raise ValueError("crop")
        genai, types = _load_sdk()
        if client is None:
            timeout = _safe_timeout(
                timeout_seconds
                if timeout_seconds is not None
                else os.getenv("GEMINI_TIMEOUT_SECONDS", "20")
            )
            client = genai.Client(
                api_key=key,
                http_options=types.HttpOptions(timeout=int(timeout * 1000)),
            )
            owns_client = True
        contents: list[Any] = [PROMPT]
        for key_name, label in zip(CELL_KEYS, CELL_LABELS):
            contents.append(label)
            contents.append(types.Part.from_bytes(
                data=_encode_crop(crops[key_name]),
                mime_type="image/jpeg",
            ))
        response = client.models.generate_content(
            model=selected_model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=RESPONSE_SCHEMA,
                temperature=0,
            ),
        )
        payload = json.loads(str(getattr(response, "text", "") or ""))
        fields = _validate_payload(payload)
        return GeminiBirthResult(
            True,
            fields=fields,
            enabled=True,
            model=selected_model,
        )
    except Exception as exc:
        return GeminiBirthResult(
            False,
            enabled=True,
            model=selected_model,
            error_code=_error_code(exc),
        )
    finally:
        if owns_client and client is not None:
            try:
                client.close()
            except Exception:
                pass


__all__ = [
    "CELL_KEYS",
    "FIELD_KEYS",
    "GeminiBirthResult",
    "extract_with_gemini",
]
