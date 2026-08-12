"""Pi-local, versioned geometry for the fixed PSA Birth capture station."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Mapping

from extraction.psa_birth_row_cropper import (
    FIELD_NAMES,
    PSABirthRowCropperConfig,
    REGISTERED_HEIGHT,
    REGISTERED_WIDTH,
)


CALIBRATION_VERSION = 1


def calibration_path() -> Path:
    configured = os.getenv("BIRTH_STATION_CALIBRATION_PATH", "").strip()
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".config" / "smart-pdm" / "birth_station_calibration.json"


def _validated_rows(value: Any) -> tuple[tuple[Any, ...], ...]:
    if not isinstance(value, list) or len(value) != len(FIELD_NAMES):
        raise ValueError("calibration must contain Items 1, 6, and 13")
    rows: list[tuple[Any, ...]] = []
    for expected_name, source in zip(FIELD_NAMES, value):
        if not isinstance(source, Mapping):
            raise ValueError("calibration row must be an object")
        name = str(source.get("field_name") or "")
        if name != expected_name:
            raise ValueError("calibration rows are not in approved physical order")
        row = (
            name,
            int(source["left"]),
            int(source["first_right"]),
            int(source["middle_right"]),
            int(source["right"]),
            int(source["top"]),
            int(source["bottom"]),
        )
        rows.append(row)
    # Reuse the cropper's complete geometry validation rather than allowing a
    # second, weaker interpretation of the calibration artifact.
    return PSABirthRowCropperConfig(row_geometries=tuple(rows)).row_geometries


def load_birth_station_calibration(
    path: Path | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    target = path or calibration_path()
    if not target.is_file():
        return {}, {"status": "repository_default", "version": CALIBRATION_VERSION}
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
        if int(payload.get("version")) != CALIBRATION_VERSION:
            raise ValueError("unsupported calibration version")
        if payload.get("canvas") != {
            "width": REGISTERED_WIDTH,
            "height": REGISTERED_HEIGHT,
        }:
            raise ValueError("calibration canvas does not match PSA canvas")
        rows = _validated_rows(payload.get("rows"))
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        return {}, {"status": "invalid", "version": CALIBRATION_VERSION}
    return (
        {"row_geometries": rows},
        {
            "status": "loaded",
            "version": CALIBRATION_VERSION,
            "row_count": len(rows),
        },
    )


def save_birth_station_calibration(
    rows: list[Mapping[str, Any]],
    path: Path | None = None,
) -> Path:
    target = path or calibration_path()
    validated = _validated_rows(rows)
    payload = {
        "version": CALIBRATION_VERSION,
        "canvas": {"width": REGISTERED_WIDTH, "height": REGISTERED_HEIGHT},
        "rows": [
            {
                "field_name": row[0],
                "left": row[1],
                "first_right": row[2],
                "middle_right": row[3],
                "right": row[4],
                "top": row[5],
                "bottom": row[6],
            }
            for row in validated
        ],
    }
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    try:
        os.chmod(temporary, 0o600)
    except OSError:
        pass
    os.replace(temporary, target)
    return target


__all__ = [
    "CALIBRATION_VERSION",
    "calibration_path",
    "load_birth_station_calibration",
    "save_birth_station_calibration",
]
