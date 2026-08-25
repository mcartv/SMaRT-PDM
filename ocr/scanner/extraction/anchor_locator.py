from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any

from .geometry import NormalizedBounds
from .models import AnchorResult


_LABEL_TO_FIELD = {
    "child name": "child_name",
    "name of child": "child_name",
    "mother maiden name": "mother_maiden_name",
    "mothers maiden name": "mother_maiden_name",
    "father name": "father_name",
    "fathers name": "father_name",
}


def _normalize_label(text: str) -> str:
    normalized = text.casefold().replace("'", "").replace("\u2019", "")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", normalized).split())


def _read_bounds(value: Any) -> NormalizedBounds:
    if isinstance(value, NormalizedBounds):
        return value
    if isinstance(value, Mapping):
        return NormalizedBounds.from_dict(dict(value))
    raise ValueError("OCR item bounds must be NormalizedBounds or a bounds mapping")


def locate_birth_certificate_anchors(
    ocr_items: Iterable[Mapping[str, Any]],
) -> list[AnchorResult]:
    """Locate supported birth-certificate labels without extracting field values."""
    anchors: list[AnchorResult] = []
    located_fields: set[str] = set()

    for item in ocr_items:
        if not isinstance(item, Mapping):
            raise ValueError("Each OCR item must be a mapping")
        if "text" not in item or "bounds" not in item:
            raise ValueError("Each OCR item must contain text and bounds")

        text = item["text"]
        if not isinstance(text, str):
            raise ValueError("OCR item text must be a string")

        field_name = _LABEL_TO_FIELD.get(_normalize_label(text))
        if field_name is None or field_name in located_fields:
            continue

        anchors.append(
            AnchorResult(
                name=field_name,
                bounds=_read_bounds(item["bounds"]),
                confidence=1.0,
                success=True,
                match_text=text,
            )
        )
        located_fields.add(field_name)

    return anchors
