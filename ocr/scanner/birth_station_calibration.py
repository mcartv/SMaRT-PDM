"""Pi-local, versioned geometry for the fixed PSA Birth capture station."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

import cv2
import numpy as np

from extraction.psa_birth_row_cropper import (
    FIELD_NAMES,
    PSABirthRowCropperConfig,
    REGISTERED_HEIGHT,
    REGISTERED_WIDTH,
)


CALIBRATION_VERSION = 2
MANUAL_REGISTRATION_MODE = "manual_station_quad"
_MINIMUM_QUAD_AREA = 0.08


def fit_capture_to_display(
    source_shape: tuple[int, ...],
    screen_width: int,
    screen_height: int,
    *,
    reserved_height: int = 96,
    horizontal_padding: int = 32,
) -> tuple[int, int, float]:
    """Fit the complete capture inside a small Pi display without clipping."""

    source_height, source_width = source_shape[:2]
    if source_width < 1 or source_height < 1:
        raise ValueError("capture dimensions must be positive")
    available_width = max(160, int(screen_width) - int(horizontal_padding))
    available_height = max(120, int(screen_height) - int(reserved_height))
    scale = min(
        available_width / float(source_width),
        available_height / float(source_height),
        1.0,
    )
    return (
        max(1, int(round(source_width * scale))),
        max(1, int(round(source_height * scale))),
        scale,
    )


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


def validate_normalized_corners(value: Any) -> tuple[tuple[float, float], ...]:
    """Validate clockwise TL/TR/BR/BL source corners without guessing order."""

    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise ValueError("manual registration requires four source corners")
    points = np.asarray(value, dtype=np.float64)
    if points.shape != (4, 2) or not np.isfinite(points).all():
        raise ValueError("manual source corners must be finite coordinate pairs")
    if np.any(points < 0.0) or np.any(points > 1.0):
        raise ValueError("manual source corners must stay inside the capture")
    cross_products = []
    for index in range(4):
        current = points[index]
        following = points[(index + 1) % 4]
        after = points[(index + 2) % 4]
        first = following - current
        second = after - following
        cross_products.append(float(first[0] * second[1] - first[1] * second[0]))
    if not (all(value > 0 for value in cross_products) or all(value < 0 for value in cross_products)):
        raise ValueError("manual source corners are crossed or non-convex")
    area = abs(float(cv2.contourArea(points.astype(np.float32))))
    if area < _MINIMUM_QUAD_AREA:
        raise ValueError("manual source quadrilateral is too small")
    return tuple((float(x), float(y)) for x, y in points)


def warp_birth_station_capture(
    image: np.ndarray,
    normalized_corners: Any,
) -> tuple[np.ndarray, tuple[float, ...]]:
    if image is None or image.size == 0:
        raise ValueError("manual registration source image is empty")
    corners = validate_normalized_corners(normalized_corners)
    height, width = image.shape[:2]
    source = np.asarray(
        [[x * width, y * height] for x, y in corners],
        dtype=np.float32,
    )
    destination = np.asarray(
        [[0, 0], [REGISTERED_WIDTH - 1, 0],
         [REGISTERED_WIDTH - 1, REGISTERED_HEIGHT - 1],
         [0, REGISTERED_HEIGHT - 1]],
        dtype=np.float32,
    )
    homography = cv2.getPerspectiveTransform(source, destination)
    if not np.isfinite(homography).all() or abs(float(np.linalg.det(homography))) < 1e-12:
        raise ValueError("manual source corners do not produce a valid perspective transform")
    registered = cv2.warpPerspective(
        image,
        homography,
        (REGISTERED_WIDTH, REGISTERED_HEIGHT),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255),
    )
    return registered, tuple(float(value) for value in homography.reshape(-1))


def normalized_corners_from_homography(
    homography: Any,
    source_shape: tuple[int, ...],
) -> tuple[tuple[float, float], ...]:
    height, width = source_shape[:2]
    destination = np.asarray([[0, 0], [REGISTERED_WIDTH - 1, 0],
                              [REGISTERED_WIDTH - 1, REGISTERED_HEIGHT - 1],
                              [0, REGISTERED_HEIGHT - 1]], dtype=np.float32).reshape(1, 4, 2)
    matrix = np.asarray(homography, dtype=np.float64).reshape(3, 3)
    source = cv2.perspectiveTransform(destination, np.linalg.inv(matrix))[0]
    return validate_normalized_corners([
        [min(1.0, max(0.0, float(x) / width)),
         min(1.0, max(0.0, float(y) / height))]
        for x, y in source
    ])


def load_birth_station_calibration(
    path: Path | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    target = path or calibration_path()
    if not target.is_file():
        return {}, {"status": "repository_default", "version": CALIBRATION_VERSION}
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
        version = int(payload.get("version"))
        if version != CALIBRATION_VERSION:
            raise ValueError("unsupported calibration version")
        if payload.get("canvas") != {
            "width": REGISTERED_WIDTH,
            "height": REGISTERED_HEIGHT,
        }:
            raise ValueError("calibration canvas does not match PSA canvas")
        rows = _validated_rows(payload.get("rows"))
        registration = payload.get("manual_registration")
        if not isinstance(registration, Mapping):
            raise ValueError("manual source registration is missing")
        corners = validate_normalized_corners(registration.get("normalized_corners"))
        source_size = registration.get("source_size")
        if (not isinstance(source_size, Mapping)
                or int(source_size.get("width", 0)) < 1
                or int(source_size.get("height", 0)) < 1):
            raise ValueError("manual registration source size is invalid")
        verified_at = str(registration.get("verified_at") or "").strip()
        if not verified_at:
            raise ValueError("manual registration verification timestamp is missing")
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        return {}, {"status": "invalid", "version": CALIBRATION_VERSION}
    return (
        {"row_geometries": rows},
        {
            "status": "loaded",
            "version": CALIBRATION_VERSION,
            "row_count": len(rows),
            "registration_mode": str(registration.get("mode") or MANUAL_REGISTRATION_MODE),
            "normalized_corners": corners,
            "source_size": {
                "width": int(source_size["width"]),
                "height": int(source_size["height"]),
            },
            "verified_at": verified_at,
        },
    )


def save_birth_station_calibration(
    rows: list[Mapping[str, Any]],
    path: Path | None = None,
    *,
    normalized_corners: Any,
    source_shape: tuple[int, ...],
    registration_mode: str = MANUAL_REGISTRATION_MODE,
) -> Path:
    target = path or calibration_path()
    validated = _validated_rows(rows)
    corners = validate_normalized_corners(normalized_corners)
    source_height, source_width = source_shape[:2]
    if source_width < 1 or source_height < 1:
        raise ValueError("manual registration source size is invalid")
    payload = {
        "version": CALIBRATION_VERSION,
        "canvas": {"width": REGISTERED_WIDTH, "height": REGISTERED_HEIGHT},
        "manual_registration": {
            "mode": str(registration_mode or MANUAL_REGISTRATION_MODE),
            "normalized_corners": [[x, y] for x, y in corners],
            "source_size": {"width": int(source_width), "height": int(source_height)},
            "verified_at": datetime.now(timezone.utc).isoformat(),
        },
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
    "fit_capture_to_display",
    "load_birth_station_calibration",
    "normalized_corners_from_homography",
    "save_birth_station_calibration",
    "validate_normalized_corners",
    "warp_birth_station_capture",
]
