from __future__ import annotations

from dataclasses import dataclass
import math


def _validate_unit_interval(value: float, field_name: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{field_name} must be numeric")
    if not math.isfinite(value):
        raise ValueError(f"{field_name} must be finite")
    if value < 0.0 or value > 1.0:
        raise ValueError(f"{field_name} must be between 0.0 and 1.0")


@dataclass(frozen=True)
class NormalizedBounds:
    x: float
    y: float
    width: float
    height: float

    def __post_init__(self) -> None:
        _validate_unit_interval(self.x, "x")
        _validate_unit_interval(self.y, "y")
        _validate_unit_interval(self.width, "width")
        _validate_unit_interval(self.height, "height")
        if self.x + self.width > 1.0:
            raise ValueError("x + width must be <= 1.0")
        if self.y + self.height > 1.0:
            raise ValueError("y + height must be <= 1.0")

    def to_dict(self) -> dict[str, float]:
        return {
            "x": float(self.x),
            "y": float(self.y),
            "width": float(self.width),
            "height": float(self.height),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NormalizedBounds":
        return cls(
            x=data["x"],
            y=data["y"],
            width=data["width"],
            height=data["height"],
        )
