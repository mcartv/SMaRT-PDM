"""Canonical, text-only OCR review candidate models."""

from dataclasses import asdict, dataclass, field
from typing import Any, Optional


FORBIDDEN_KEYS = {
    "image", "image_url", "capture_url", "capture_path", "processed_image",
    "processed_image_url", "base64_image",
}


def _assert_text_only(value: Any) -> None:
    if not isinstance(value, (dict, list, tuple)):
        return
    items = value.items() if isinstance(value, dict) else enumerate(value)
    for key, nested in items:
        if isinstance(key, str) and key.casefold() in FORBIDDEN_KEYS:
            raise ValueError(f"Forbidden OCR image field: {key}")
        _assert_text_only(nested)


@dataclass(frozen=True)
class FieldResult:
    raw_text: str
    normalized_value: Any
    confidence: Optional[float]
    validation_issues: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class ReviewCandidate:
    request_id: str
    document_key: str
    template_id: str
    raw_text: str
    fields: dict[str, Any]
    field_confidence: dict[str, Optional[float]]
    validation_issues: list[dict[str, Any]]
    registration_status: str
    processing_metadata: dict[str, Any] = field(default_factory=dict)

    def serialize(self) -> dict[str, Any]:
        payload = {
            "request_id": self.request_id,
            "status": "review_required",
            "document_key": self.document_key,
            "template_id": self.template_id,
            "raw_text": self.raw_text,
            "fields": self.fields,
            "field_confidence": self.field_confidence,
            "validation_issues": self.validation_issues,
            "review_required": True,
            "processing": {
                "registration_status": self.registration_status,
                "preprocessing_variant": self.template_id,
                "ocr_engine": "tesseract",
                **dict(self.processing_metadata),
            },
        }
        _assert_text_only(payload)
        return payload


def field_result_dict(result: FieldResult) -> dict[str, Any]:
    return asdict(result)
