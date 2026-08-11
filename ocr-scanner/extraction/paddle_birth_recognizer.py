from __future__ import annotations

import importlib
from threading import Lock
from typing import Any, Mapping, Sequence

import numpy as np


class PaddleBirthOCRUnavailable(RuntimeError):
    """Raised when the optional Paddle birth-recognition runtime is unavailable."""


_MODEL_LOCK = Lock()
_INFERENCE_LOCK = Lock()
_MODELS: dict[str, Any] = {}


def _load_model(model_name: str) -> Any:
    with _MODEL_LOCK:
        existing = _MODELS.get(model_name)
        if existing is not None:
            return existing
        try:
            paddleocr = importlib.import_module("paddleocr")
            model_type = getattr(paddleocr, "TextRecognition")
            model = model_type(
                model_name=model_name,
                device="cpu",
                enable_hpi=False,
                cpu_threads=2,
            )
        except Exception as error:
            raise PaddleBirthOCRUnavailable(
                "PaddleOCR birth recognition is unavailable"
            ) from error
        _MODELS[model_name] = model
        return model


def _result_payload(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        payload: Any = value
    else:
        payload = getattr(value, "json", None)
        if callable(payload):
            payload = payload()
    if not isinstance(payload, Mapping):
        return {}
    nested = payload.get("res")
    return nested if isinstance(nested, Mapping) else payload


def recognize_birth_name_batch(
    images: Sequence[np.ndarray],
    *,
    model_name: str = "PP-OCRv6_medium_rec",
    batch_size: int = 3,
) -> tuple[tuple[str, float | None], ...]:
    """Recognize already-cropped PSA name cells with one shared Paddle model."""

    prepared = [np.ascontiguousarray(image) for image in images]
    if not prepared:
        return ()
    model = _load_model(model_name)
    try:
        # Paddle inference objects are shared but are not documented as thread-safe.
        with _INFERENCE_LOCK:
            results = list(
                model.predict(
                    input=prepared,
                    batch_size=max(1, min(int(batch_size), len(prepared))),
                )
            )
    except Exception as error:
        raise PaddleBirthOCRUnavailable(
            "PaddleOCR birth recognition failed"
        ) from error

    observations: list[tuple[str, float | None]] = []
    for index in range(len(prepared)):
        payload = _result_payload(results[index]) if index < len(results) else {}
        raw_text = str(payload.get("rec_text") or "").strip()
        raw_score = payload.get("rec_score")
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = None
        if score is not None and not 0.0 <= score <= 1.0:
            score = None
        observations.append((raw_text, score))
    return tuple(observations)


def reset_birth_paddle_model_for_tests() -> None:
    with _MODEL_LOCK:
        _MODELS.clear()
