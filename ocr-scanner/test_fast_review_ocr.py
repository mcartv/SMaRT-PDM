from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np

import job_worker
import ocr
from extraction.indigency_core_field_extraction import (
    IndigencyExtractionConfig,
    extract_indigency_core_fields,
)


def _empty_data():
    return {
        "text": [],
        "conf": [],
        "left": [],
        "top": [],
        "width": [],
        "height": [],
        "block_num": [],
        "par_num": [],
        "line_num": [],
    }


def _add_line(
    data,
    text,
    *,
    y,
    block,
    paragraph,
    line,
    x=80,
):
    cursor = x
    for token in text.split():
        width = max(18, len(token) * 10)
        data["text"].append(token)
        data["conf"].append(92)
        data["left"].append(cursor)
        data["top"].append(y)
        data["width"].append(width)
        data["height"].append(28)
        data["block_num"].append(block)
        data["par_num"].append(paragraph)
        data["line_num"].append(line)
        cursor += width + 12


def _valid_word_data():
    data = _empty_data()
    _add_line(
        data,
        "SANGGUNIANG BARANGAY OF SAMPLE II",
        y=40,
        block=1,
        paragraph=1,
        line=1,
    )
    _add_line(
        data,
        "CERTIFICATE OF INDIGENCY",
        y=120,
        block=2,
        paragraph=1,
        line=1,
        x=250,
    )
    _add_line(
        data,
        (
            "This is to certify that SAMPLE SUBJECT, 30 years old "
            "is a bona fide resident of SAMPLE STREET."
        ),
        y=360,
        block=3,
        paragraph=1,
        line=1,
    )
    _add_line(
        data,
        "Given this 16th day of July 2026 at the barangay office.",
        y=680,
        block=4,
        paragraph=1,
        line=1,
    )
    return data


class FastReviewOcrTest(unittest.TestCase):
    def test_indigency_fast_mode_uses_one_detection_pass(self):
        calls = []
        field_reader = MagicMock(return_value="")

        def word_reader(_image, variant, config):
            calls.append((variant, config.fast_mode))
            return _valid_word_data()

        image = np.full((900, 1800, 3), 255, dtype=np.uint8)
        result = extract_indigency_core_fields(
            image,
            word_reader=word_reader,
            field_reader=field_reader,
            config=IndigencyExtractionConfig(
                fast_mode=True,
                maximum_detection_width=1600,
                ocr_timeout_seconds=25,
            ),
        )

        self.assertTrue(result.success)
        self.assertEqual(calls, [("grayscale", True)])
        self.assertEqual(result.metrics["candidate_count"], 1)
        field_reader.assert_not_called()

        values = {
            field.name: field.raw_text
            for field in result.data.fields
        }
        self.assertIn(
            "SAMPLE SUBJECT",
            values["certificate_subject_name"],
        )
        self.assertEqual(
            values["residency_address"],
            "12 SAMPLE STREET MARILAO BULACAN.",
        )
        self.assertIn("July 2026", values["issue_date"])
        self.assertEqual(
            values["issuing_barangay"],
            "SAMPLE II",
        )

    @patch("job_worker.write_text_file")
    @patch("job_worker.clear_tmp_files")
    def test_fast_generic_ocr_skips_expensive_spell_correction(
        self,
        clear_files,
        write_file,
    ):
        reader = MagicMock(return_value="RAW GRADE FORM OCR")

        with patch.object(
            job_worker,
            "FAST_REVIEW_OCR_ENABLED",
            True,
        ):
            raw_text, corrected_text = job_worker._run_generic_ocr(
                "/tmp/test.jpg",
                text_reader=reader,
            )

        self.assertEqual(raw_text, "RAW GRADE FORM OCR")
        self.assertEqual(corrected_text, raw_text)
        reader.assert_called_once_with("/tmp/test.jpg")
        clear_files.assert_called_once()
        self.assertEqual(write_file.call_count, 2)

    def test_bounded_ocr_timeout_returns_empty_result(self):
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "capture.jpg"
            image = np.full(
                (240, 320, 3),
                255,
                dtype=np.uint8,
            )
            self.assertTrue(
                cv2.imwrite(str(image_path), image)
            )

            with patch(
                "ocr.pytesseract.image_to_string",
                side_effect=RuntimeError("timeout"),
            ):
                result = ocr.extract_text(
                    str(image_path),
                    timeout_seconds=5,
                )

        self.assertEqual(result, "")


if __name__ == "__main__":
    unittest.main()
