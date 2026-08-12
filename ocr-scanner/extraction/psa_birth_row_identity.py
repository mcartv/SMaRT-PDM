"""Printed-label evidence for calibrated PSA Birth name rows."""

from __future__ import annotations

import re
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping

import cv2
import numpy as np
import pytesseract

from .psa_birth_row_cropper import ValidatedNameRowTopology
from .stage_result import StageResult


STAGE_NAME = "psa_birth_row_identity"
EXPECTED_ITEMS = {
    "child_name": ("1", "NAME"),
    "mother_maiden_name": ("6", "MAIDEN NAME"),
    "father_name": ("13", "NAME"),
}


@dataclass(frozen=True)
class BirthRowIdentityEvidence:
    field_name: str
    expected_item: str
    status: str
    confidence: float | None


def _words(image: np.ndarray) -> tuple[str, float | None]:
    data = pytesseract.image_to_data(
        image,
        config="--oem 3 --psm 6 -l eng",
        output_type=pytesseract.Output.DICT,
        timeout=5.0,
    )
    values: list[str] = []
    weighted: list[tuple[float, int]] = []
    for text, raw_confidence in zip(data.get("text", ()), data.get("conf", ())):
        value = str(text or "").strip()
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            continue
        if not value or confidence < 0:
            continue
        values.append(value)
        weighted.append((confidence, max(1, len(value))))
    denominator = sum(weight for _confidence, weight in weighted)
    average = (
        sum(confidence * weight for confidence, weight in weighted) / denominator
        if denominator
        else None
    )
    return " ".join(values), average


def identify_psa_birth_name_rows(
    registered_image: Any,
    topology: Mapping[str, ValidatedNameRowTopology],
) -> StageResult[Mapping[str, BirthRowIdentityEvidence]]:
    if not isinstance(registered_image, np.ndarray) or registered_image.size == 0:
        return StageResult(STAGE_NAME, False, "failed", issues=[{
            "code": "BIRTH_ROW_IDENTITY_IMAGE_INVALID",
        }])
    height, width = registered_image.shape[:2]
    evidence: dict[str, BirthRowIdentityEvidence] = {}
    issues: list[dict[str, str]] = []
    conflicts: list[str] = []
    for field_name, (expected_item, expected_label) in EXPECTED_ITEMS.items():
        row = topology.get(field_name)
        if row is None:
            return StageResult(STAGE_NAME, False, "failed", issues=[{
                "code": "BIRTH_ROW_IDENTITY_TOPOLOGY_MISSING",
                "field": field_name,
            }])
        if not isinstance(row, ValidatedNameRowTopology):
            evidence[field_name] = BirthRowIdentityEvidence(
                field_name=field_name,
                expected_item=expected_item,
                status="unknown",
                confidence=None,
            )
            issues.append({
                "code": "BIRTH_ROW_LABEL_EVIDENCE_WEAK",
                "field": field_name,
            })
            continue
        label_right = max(1, min(width, row.component_boundaries[0] + 18))
        top = max(0, row.top - 30)
        bottom = min(height, row.bottom + 12)
        label_crop = registered_image[top:bottom, 0:label_right]
        try:
            gray = cv2.cvtColor(label_crop, cv2.COLOR_BGR2GRAY) if label_crop.ndim == 3 else label_crop
            enlarged = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
            text, confidence = _words(enlarged)
        except Exception:
            text, confidence = "", None
        normalized = re.sub(r"[^A-Z0-9]+", " ", text.upper()).strip()
        numbers = set(re.findall(r"\b(?:1|6|13)\b", normalized))
        expected_number = expected_item in numbers
        expected_words = all(word in normalized.split() for word in expected_label.split())
        wrong_items = numbers - {expected_item}
        if wrong_items and not expected_number:
            status = "conflict"
            conflicts.append(field_name)
            issues.append({
                "code": "BIRTH_ROW_LABEL_CONFLICT",
                "field": field_name,
            })
        elif expected_number and expected_words:
            status = "matched"
        else:
            status = "unknown"
            issues.append({
                "code": "BIRTH_ROW_LABEL_EVIDENCE_WEAK",
                "field": field_name,
            })
        evidence[field_name] = BirthRowIdentityEvidence(
            field_name=field_name,
            expected_item=expected_item,
            status=status,
            confidence=confidence,
        )
    return StageResult(
        stage=STAGE_NAME,
        success=not conflicts,
        status="failed" if conflicts else ("review_required" if issues else "success"),
        data=MappingProxyType(evidence),
        issues=issues,
        metrics={
            "matched_row_count": sum(item.status == "matched" for item in evidence.values()),
            "weak_row_count": sum(item.status == "unknown" for item in evidence.values()),
            "conflict_row_count": len(conflicts),
            "row_status": {name: item.status for name, item in evidence.items()},
        },
    )


__all__ = ["BirthRowIdentityEvidence", "identify_psa_birth_name_rows"]
