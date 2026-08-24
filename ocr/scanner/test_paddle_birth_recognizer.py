from __future__ import annotations

from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

from extraction.paddle_birth_recognizer import (
    PaddleBirthOCRUnavailable,
    recognize_birth_name_batch,
    reset_birth_paddle_model_for_tests,
)


class _FakeResult:
    def __init__(self, text: str, score: float):
        self.json = {"res": {"rec_text": text, "rec_score": score}}


class _FakeTextRecognition:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.predict_calls = []
        self.__class__.instances.append(self)

    def predict(self, *, input, batch_size):
        self.predict_calls.append((input, batch_size))
        return [_FakeResult(f"Name {index}", 0.91) for index in range(len(input))]


class PaddleBirthRecognizerTest(unittest.TestCase):
    def setUp(self):
        reset_birth_paddle_model_for_tests()
        _FakeTextRecognition.instances.clear()

    def tearDown(self):
        reset_birth_paddle_model_for_tests()

    def test_batches_cropped_rois_and_reads_real_paddle_scores(self):
        images = [np.full((40, 180), 255, dtype=np.uint8) for _ in range(3)]
        module = SimpleNamespace(TextRecognition=_FakeTextRecognition)
        with patch(
            "extraction.paddle_birth_recognizer.importlib.import_module",
            return_value=module,
        ):
            result = recognize_birth_name_batch(
                images,
                model_name="en_PP-OCRv5_mobile_rec",
                batch_size=3,
            )

        self.assertEqual(
            result,
            (("Name 0", 0.91), ("Name 1", 0.91), ("Name 2", 0.91)),
        )
        self.assertEqual(len(_FakeTextRecognition.instances), 1)
        model = _FakeTextRecognition.instances[0]
        self.assertEqual(model.kwargs["model_name"], "en_PP-OCRv5_mobile_rec")
        self.assertEqual(model.kwargs["device"], "cpu")
        self.assertEqual(model.kwargs["engine"], "onnxruntime")
        self.assertEqual(
            model.kwargs["engine_config"]["providers"],
            ["CPUExecutionProvider"],
        )
        self.assertEqual(
            model.kwargs["engine_config"]["intra_op_num_threads"],
            2,
        )
        self.assertEqual(model.predict_calls[0][1], 3)

    def test_missing_runtime_fails_closed_for_tesseract_fallback(self):
        with patch(
            "extraction.paddle_birth_recognizer.importlib.import_module",
            side_effect=ModuleNotFoundError("paddleocr"),
        ):
            with self.assertRaises(PaddleBirthOCRUnavailable):
                recognize_birth_name_batch(
                    [np.full((20, 80), 255, dtype=np.uint8)],
                )


if __name__ == "__main__":
    unittest.main()
