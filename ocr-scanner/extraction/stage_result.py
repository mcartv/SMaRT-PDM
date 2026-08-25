from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Generic, List, Optional, TypeVar


T = TypeVar("T")


@dataclass
class StageResult(Generic[T]):
    stage: str
    success: bool
    status: str
    data: Optional[T] = None
    issues: List[Dict[str, Any]] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stage": self.stage,
            "success": self.success,
            "status": self.status,
            "data": self.data,
            "issues": [dict(issue) for issue in self.issues],
            "metrics": dict(self.metrics),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StageResult[Any]":
        return cls(
            stage=str(data["stage"]),
            success=bool(data["success"]),
            status=str(data["status"]),
            data=data.get("data"),
            issues=[dict(issue) for issue in data.get("issues", [])],
            metrics=dict(data.get("metrics", {})),
        )
