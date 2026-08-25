from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .geometry import NormalizedBounds
from .stage_result import StageResult
from .validation import (
    ALLOWED_OVERALL_STATUSES,
    ALLOWED_STAGE_STATUSES,
    validate_issue_codes,
    validate_metric_values,
    validate_stage_transition,
    validate_stable_code,
)


def _fresh_list(items: Optional[List[Any]]) -> List[Any]:
    return list(items or [])


def _fresh_dict(items: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return dict(items or {})


@dataclass
class NormalizedImageMetadata:
    original_width: int
    original_height: int
    normalized_width: int
    normalized_height: int
    skew_correction_applied: bool = False
    perspective_correction_applied: bool = False
    crop_offset_x: float = 0.0
    crop_offset_y: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_width": self.original_width,
            "original_height": self.original_height,
            "normalized_width": self.normalized_width,
            "normalized_height": self.normalized_height,
            "skew_correction_applied": self.skew_correction_applied,
            "perspective_correction_applied": self.perspective_correction_applied,
            "crop_offset_x": self.crop_offset_x,
            "crop_offset_y": self.crop_offset_y,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NormalizedImageMetadata":
        return cls(
            original_width=int(data["original_width"]),
            original_height=int(data["original_height"]),
            normalized_width=int(data["normalized_width"]),
            normalized_height=int(data["normalized_height"]),
            skew_correction_applied=bool(data.get("skew_correction_applied", False)),
            perspective_correction_applied=bool(data.get("perspective_correction_applied", False)),
            crop_offset_x=float(data.get("crop_offset_x", 0.0)),
            crop_offset_y=float(data.get("crop_offset_y", 0.0)),
        )


@dataclass
class AnchorResult:
    name: str
    bounds: NormalizedBounds
    confidence: float
    success: bool
    match_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "bounds": self.bounds.to_dict(),
            "confidence": self.confidence,
            "success": self.success,
            "match_text": self.match_text,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AnchorResult":
        return cls(
            name=str(data["name"]),
            bounds=NormalizedBounds.from_dict(data["bounds"]),
            confidence=float(data["confidence"]),
            success=bool(data["success"]),
            match_text=str(data.get("match_text", "")),
        )


@dataclass
class RegionResult:
    name: str
    bounds: NormalizedBounds
    success: bool
    confidence: float = 0.0
    ocr_attempts: int = 0
    preprocessing_variant: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "bounds": self.bounds.to_dict(),
            "success": self.success,
            "confidence": self.confidence,
            "ocr_attempts": self.ocr_attempts,
            "preprocessing_variant": self.preprocessing_variant,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RegionResult":
        return cls(
            name=str(data["name"]),
            bounds=NormalizedBounds.from_dict(data["bounds"]),
            success=bool(data["success"]),
            confidence=float(data.get("confidence", 0.0)),
            ocr_attempts=int(data.get("ocr_attempts", 0)),
            preprocessing_variant=str(data.get("preprocessing_variant", "")),
        )


@dataclass
class FieldCandidate:
    field_name: str
    value: Dict[str, str]
    confidence: float
    source_region: str = ""
    accepted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field_name": self.field_name,
            "value": dict(self.value),
            "confidence": self.confidence,
            "source_region": self.source_region,
            "accepted": self.accepted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FieldCandidate":
        return cls(
            field_name=str(data["field_name"]),
            value=dict(data["value"]),
            confidence=float(data["confidence"]),
            source_region=str(data.get("source_region", "")),
            accepted=bool(data.get("accepted", False)),
        )


@dataclass
class ValidationIssue:
    code: str
    severity: str
    stage: str
    field: str = ""
    message: str = ""

    def __post_init__(self) -> None:
        validate_stable_code(self.code)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "severity": self.severity,
            "stage": self.stage,
            "field": self.field,
            "message": self.message,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ValidationIssue":
        return cls(
            code=str(data["code"]),
            severity=str(data["severity"]),
            stage=str(data["stage"]),
            field=str(data.get("field", "")),
            message=str(data.get("message", "")),
        )


@dataclass
class ReviewReason:
    code: str
    message: str = ""

    def __post_init__(self) -> None:
        validate_stable_code(self.code)

    def to_dict(self) -> Dict[str, Any]:
        return {"code": self.code, "message": self.message}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewReason":
        return cls(code=str(data["code"]), message=str(data.get("message", "")))


@dataclass
class BirthExtractionResult:
    document_key: str
    overall_status: str = "pending"
    stage_statuses: Dict[str, str] = field(
        default_factory=lambda: {
            "normalization": "not_started",
            "anchor_detection": "not_started",
            "region_extraction": "not_started",
            "ocr": "not_started",
            "validation": "not_started",
            "contract_building": "not_started",
        }
    )
    normalized_image: Optional[NormalizedImageMetadata] = None
    anchors: List[AnchorResult] = field(default_factory=list)
    regions: List[RegionResult] = field(default_factory=list)
    field_candidates: List[FieldCandidate] = field(default_factory=list)
    field_confidence: Dict[str, float] = field(default_factory=dict)
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    review_reasons: List[ReviewReason] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    final_contract_payload: Optional[Dict[str, Any]] = None

    def __post_init__(self) -> None:
        if not self.document_key:
            raise ValueError("document_key is required")
        self.stage_statuses = dict(self.stage_statuses)
        self.anchors = list(self.anchors)
        self.regions = list(self.regions)
        self.field_candidates = list(self.field_candidates)
        self.field_confidence = dict(self.field_confidence)
        self.validation_issues = list(self.validation_issues)
        self.review_reasons = list(self.review_reasons)
        self.metrics = dict(self.metrics)
        self.final_contract_payload = deepcopy(self.final_contract_payload)
        if self.normalized_image is not None and not isinstance(self.normalized_image, NormalizedImageMetadata):
            raise TypeError("normalized_image must be NormalizedImageMetadata or None")
        self._validate_stage_statuses()
        self._validate_overall_status()
        self._validate_metrics()
        self._validate_codes()

    def _validate_stage_statuses(self) -> None:
        for stage, status in self.stage_statuses.items():
            if status not in ALLOWED_STAGE_STATUSES:
                raise ValueError(f"Invalid stage status for {stage}: {status}")

    def _validate_overall_status(self) -> None:
        if self.overall_status not in ALLOWED_OVERALL_STATUSES:
            raise ValueError(f"Invalid overall_status: {self.overall_status}")

    def _validate_metrics(self) -> None:
        validate_metric_values(self.metrics)

    def _validate_codes(self) -> None:
        validate_issue_codes(issue.to_dict() for issue in self.validation_issues)
        validate_issue_codes({"code": reason.code} for reason in self.review_reasons)

    def set_overall_status(self, next_status: str) -> None:
        validate_stage_transition(self.overall_status, next_status)
        self.overall_status = next_status

    def set_stage_status(self, stage: str, status: str) -> None:
        if stage not in self.stage_statuses:
            raise ValueError(f"Unknown stage: {stage}")
        if status not in ALLOWED_STAGE_STATUSES:
            raise ValueError(f"Invalid stage status: {status}")
        self.stage_statuses[stage] = status

    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        return {
            "document_key": self.document_key,
            "overall_status": self.overall_status,
            "stage_statuses": dict(self.stage_statuses),
            "normalized_image": self.normalized_image.to_dict() if self.normalized_image else None,
            "anchors": [anchor.to_dict() for anchor in self.anchors],
            "regions": [region.to_dict() for region in self.regions],
            "field_candidates": [candidate.to_dict() for candidate in self.field_candidates] if include_sensitive else [],
            "field_confidence": dict(self.field_confidence),
            "validation_issues": [issue.to_dict() for issue in self.validation_issues],
            "review_reasons": [reason.to_dict() for reason in self.review_reasons],
            "metrics": dict(self.metrics),
            "final_contract_payload": deepcopy(self.final_contract_payload),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BirthExtractionResult":
        return cls(
            document_key=str(data["document_key"]),
            overall_status=str(data.get("overall_status", "pending")),
            stage_statuses=dict(data.get("stage_statuses", {})),
            normalized_image=(
                NormalizedImageMetadata.from_dict(data["normalized_image"]) if data.get("normalized_image") else None
            ),
            anchors=[AnchorResult.from_dict(item) for item in data.get("anchors", [])],
            regions=[RegionResult.from_dict(item) for item in data.get("regions", [])],
            field_candidates=[FieldCandidate.from_dict(item) for item in data.get("field_candidates", [])],
            field_confidence={str(key): float(value) for key, value in data.get("field_confidence", {}).items()},
            validation_issues=[ValidationIssue.from_dict(item) for item in data.get("validation_issues", [])],
            review_reasons=[ReviewReason.from_dict(item) for item in data.get("review_reasons", [])],
            metrics=dict(data.get("metrics", {})),
            final_contract_payload=deepcopy(data.get("final_contract_payload")),
        )
