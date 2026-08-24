from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import cv2
import numpy as np
import pytesseract


@dataclass(frozen=True)
class OCREngineConfig:
    language: str = "eng"
    page_segmentation_mode: int = 6
    oem: int = 3
    strip_outer_whitespace: bool = True
    preprocessing_variant: str = "grayscale_threshold"


class OCREngineError(RuntimeError):
    pass


class OCRInputError(OCREngineError):
    pass


class OCRBinaryUnavailableError(OCREngineError):
    pass


class OCRExecutionError(OCREngineError):
    pass


def _resolve_config(config: OCREngineConfig | dict[str, Any] | None) -> OCREngineConfig:
    if config is None:
        return OCREngineConfig()
    if isinstance(config, OCREngineConfig):
        return OCREngineConfig(
            language=str(config.language),
            page_segmentation_mode=int(config.page_segmentation_mode),
            oem=int(config.oem),
            strip_outer_whitespace=bool(config.strip_outer_whitespace),
            preprocessing_variant=str(config.preprocessing_variant),
        )
    if not isinstance(config, dict):
        raise OCRInputError("config must be OCREngineConfig, a mapping, or None")
    allowed = {
        "language",
        "page_segmentation_mode",
        "oem",
        "strip_outer_whitespace",
        "preprocessing_variant",
    }
    unknown = set(config) - allowed
    if unknown:
        raise OCRInputError(f"unsupported configuration keys: {sorted(unknown)}")
    values = dict(config)
    if "language" in values and not str(values["language"]):
        raise OCRInputError("language must be a non-empty string")
    if "page_segmentation_mode" in values and int(values["page_segmentation_mode"]) <= 0:
        raise OCRInputError("page_segmentation_mode must be positive")
    if "oem" in values and int(values["oem"]) < 0:
        raise OCRInputError("oem must be non-negative")
    if "preprocessing_variant" in values and str(values["preprocessing_variant"]) != "grayscale_threshold":
        raise OCRInputError("preprocessing_variant must remain grayscale_threshold")
    return OCREngineConfig(**values)


def _prepare_image(image: Any) -> np.ndarray:
    if not isinstance(image, np.ndarray):
        raise OCRInputError("image must be a numpy array")
    if image.size == 0 or image.ndim not in (2, 3):
        raise OCRInputError("image must be a non-empty grayscale, BGR, or BGRA array")
    if image.shape[0] <= 0 or image.shape[1] <= 0:
        raise OCRInputError("image dimensions must be positive")
    if image.ndim == 3 and image.shape[2] not in (3, 4):
        raise OCRInputError("unsupported channel count")
    if image.dtype != np.uint8:
        raise OCRInputError("image must use uint8 pixels")

    working = image.copy()
    if working.ndim == 3:
        code = cv2.COLOR_BGR2GRAY if working.shape[2] == 3 else cv2.COLOR_BGRA2GRAY
        working = cv2.cvtColor(working, code)
    _, thresholded = cv2.threshold(working, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresholded


def _build_tesseract_config(config: OCREngineConfig) -> str:
    return f"--oem {config.oem} --psm {config.page_segmentation_mode}"


def _normalize_text(text: Any, strip_outer_whitespace: bool) -> str:
    if text is None:
        cleaned = ""
    elif isinstance(text, str):
        cleaned = text
    else:
        cleaned = str(text)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    if strip_outer_whitespace:
        cleaned = cleaned.strip()
    return cleaned


def ocr_image(
    image: Any,
    config: OCREngineConfig | dict[str, Any] | None = None,
    tesseract_reader: Callable[..., Any] | None = None,
) -> str:
    resolved = _resolve_config(config)
    processed = _prepare_image(image)
    config_string = _build_tesseract_config(resolved)

    reader = tesseract_reader or pytesseract.image_to_string
    try:
        try:
            text = reader(processed, lang=resolved.language, config=config_string)
        except TypeError:
            text = reader(processed, lang=resolved.language, config=config_string)
    except pytesseract.TesseractNotFoundError as exc:  # pragma: no cover - depends on local OCR install
        raise OCRBinaryUnavailableError("OCR engine unavailable") from exc
    except OCREngineError:
        raise
    except Exception as exc:  # pragma: no cover - exact reader errors are environment dependent
        raise OCRExecutionError("OCR engine execution failed") from exc

    return _normalize_text(text, resolved.strip_outer_whitespace)
