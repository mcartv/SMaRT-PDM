from __future__ import annotations

import unittest
from unittest.mock import patch

import numpy as np

from extraction.psa_birth_row_cropper import ValidatedNameRowTopology
from extraction.psa_birth_row_identity import identify_psa_birth_name_rows


def topology():
    return {
        name: ValidatedNameRowTopology(
            name,
            top,
            bottom,
            boundaries,
            (1.0, 1.0),
            (1.0, 1.0, 1.0, 1.0),
            0,
            8,
        )
        for name, top, bottom, boundaries in (
            ("child_name", 47, 107, (358, 652, 963, 1248)),
            ("mother_maiden_name", 682, 735, (321, 587, 923, 1211)),
            ("father_name", 1235, 1293, (278, 580, 921, 1268)),
        )
    }


class BirthRowIdentityTest(unittest.TestCase):
    def test_weak_labels_are_reviewable(self):
        image = np.full((1375, 1400, 3), 255, dtype=np.uint8)
        with patch(
            "extraction.psa_birth_row_identity.pytesseract.image_to_data",
            return_value={"text": [], "conf": []},
        ):
            result = identify_psa_birth_name_rows(image, topology())
        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertEqual(result.metrics["weak_row_count"], 3)

    def test_wrong_printed_item_is_blocking(self):
        image = np.full((1375, 1400, 3), 255, dtype=np.uint8)
        readings = iter(("6 MAIDEN NAME", "6 MAIDEN NAME", "13 NAME"))

        def data(*_args, **_kwargs):
            words = next(readings).split()
            return {"text": words, "conf": [95.0] * len(words)}

        with patch(
            "extraction.psa_birth_row_identity.pytesseract.image_to_data",
            side_effect=data,
        ):
            result = identify_psa_birth_name_rows(image, topology())
        self.assertFalse(result.success)
        self.assertEqual(result.metrics["row_status"]["child_name"], "conflict")


if __name__ == "__main__":
    unittest.main()
