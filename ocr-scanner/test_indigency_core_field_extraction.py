import unittest
from types import MappingProxyType
from unittest.mock import patch

import numpy as np

from extraction.indigency_core_field_extraction import (
    REQUIRED_FIELDS,
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


def _add_line(data, text, *, y, block, paragraph, line, x=80):
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


def _valid_word_data(
    *,
    title_y=120,
    duplicate_subject=False,
    header_text="SANGGUNIANG BARANGAY OF SAMPLE II",
):
    data = _empty_data()
    _add_line(
        data,
        "CERTIFICATE OF INDIGENCY",
        y=title_y,
        block=1,
        paragraph=1,
        line=1,
        x=250,
    )
    _add_line(
        data,
        header_text,
        y=40,
        block=2,
        paragraph=1,
        line=1,
    )
    _add_line(
        data,
        "OFFICE ADDRESS MARILAO BULACAN",
        y=75,
        block=2,
        paragraph=2,
        line=1,
    )
    _add_line(
        data,
        "This is to certify that SAMPLE SUBJECT, 30 years old is a bona fide resident of 12 SAMPLE STREET MARILAO BULACAN. is presently indigent",
        y=360,
        block=3,
        paragraph=1,
        line=1,
    )
    if duplicate_subject:
        _add_line(
            data,
            "This is to certify that SECOND SUBJECT is a resident of OTHER SAMPLE ADDRESS.",
            y=500,
            block=4,
            paragraph=1,
            line=1,
        )
    _add_line(
        data,
        "Given this 16th day of July 2026 at the barangay office.",
        y=680,
        block=5,
        paragraph=1,
        line=1,
    )
    return data


def _field_reader(_crop, field_name):
    return {
        "certificate_subject_name": "SAMPLE SUBJECT,",
        "issue_date": "16th day of July 2026",
        "issuing_barangay": "SAMPLE II",
    }[field_name]


class IndigencyCoreFieldExtractionTest(unittest.TestCase):
    def setUp(self):
        self.image = np.full((2000, 1600, 3), 240, dtype=np.uint8)

    def test_extracts_exact_three_provisional_fields(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertEqual(tuple(field.name for field in result.data.fields), REQUIRED_FIELDS)
        self.assertEqual(result.data.field_count, 3)
        self.assertTrue(all(field.review_required for field in result.data.fields))
        self.assertTrue(all(field.success for field in result.data.fields))
        self.assertEqual(result.metrics["successful_field_count"], 3)
        self.assertIn(
            "INDIGENCY_MANUAL_REVIEW_REQUIRED",
            {issue["code"] for issue in result.issues},
        )

    def test_title_must_be_in_upper_document_portion(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(title_y=1100),
            field_reader=_field_reader,
        )

        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertIsNone(result.data)
        self.assertEqual(result.issues[0]["code"], "INDIGENCY_DOCUMENT_NOT_DETECTED")

    def test_residency_address_cannot_satisfy_issuing_barangay(self):
        data = _valid_word_data()
        subject_start = data["block_num"].index(3)
        for index in range(subject_start, len(data["text"])):
            if data["block_num"][index] == 3 and data["text"][index].lower() == "resident":
                data["text"][index] = "located"
                break

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: data,
            field_reader=_field_reader,
        )
        fields = {field.name: field for field in result.data.fields}

        self.assertTrue(fields["issuing_barangay"].success)
        self.assertEqual(fields["issuing_barangay"].raw_text, "SAMPLE II")

    def test_known_header_variants_locate_only_the_barangay_name(self):
        variants = (
            ("PAMAHALAANG BARANGAY NG LIAS", "LIAS"),
            ("SANGGUNIANG BARANGAY OF PRENZA II", "PRENZA II"),
            ("BARANGAY LAMBAKIN", "LAMBAKIN"),
        )
        for header_text, expected in variants:
            with self.subTest(header=header_text):
                def reader(crop, field_name, expected_value=expected):
                    if field_name == "issuing_barangay":
                        return expected_value
                    return _field_reader(crop, field_name)

                result = extract_indigency_core_fields(
                    self.image,
                    word_reader=lambda *_args, value=header_text: _valid_word_data(
                        header_text=value
                    ),
                    field_reader=reader,
                )
                field = next(
                    item
                    for item in result.data.fields
                    if item.name == "issuing_barangay"
                )

                self.assertTrue(field.success)
                self.assertEqual(field.raw_text, expected)
                self.assertEqual(field.anchor, expected)

    def test_body_barangay_language_cannot_replace_missing_header_authority(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="OFFICE OF THE PUNONG BARANGAY"
            ),
            field_reader=_field_reader,
        )
        field = next(
            item
            for item in result.data.fields
            if item.name == "issuing_barangay"
        )

        self.assertFalse(field.success)
        self.assertEqual(field.raw_text, "")
        self.assertEqual(
            field.issue_codes,
            ("ISSUING_BARANGAY_NOT_EXTRACTED",),
        )

    def test_conflicting_header_barangays_are_ambiguous(self):
        data = _valid_word_data()
        _add_line(
            data,
            "BARANGAY OTHER",
            y=85,
            block=6,
            paragraph=1,
            line=1,
        )

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: data,
            field_reader=_field_reader,
        )
        field = next(
            item
            for item in result.data.fields
            if item.name == "issuing_barangay"
        )

        self.assertFalse(field.success)
        self.assertIn(
            {
                "code": "FIELD_ANCHOR_AMBIGUOUS",
                "stage": "indigency_core_field_extraction",
                "field": "issuing_barangay",
            },
            result.issues,
        )

    def test_duplicate_subject_anchors_are_ambiguous_and_empty(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(duplicate_subject=True),
            field_reader=_field_reader,
        )
        fields = {field.name: field for field in result.data.fields}
        ambiguous = {
            (issue["code"], issue["field"])
            for issue in result.issues
            if issue["code"] == "FIELD_ANCHOR_AMBIGUOUS"
        }

        self.assertFalse(fields["certificate_subject_name"].success)
        self.assertIn(
            ("FIELD_ANCHOR_AMBIGUOUS", "certificate_subject_name"),
            ambiguous,
        )

    def test_malformed_date_is_not_repaired_or_returned(self):
        def reader(crop, field_name):
            if field_name == "issue_date":
                return "32nd day of Smarch 20X6"
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=reader,
        )
        issue_date = next(field for field in result.data.fields if field.name == "issue_date")

        self.assertFalse(issue_date.success)
        self.assertEqual(issue_date.raw_text, "")
        self.assertEqual(issue_date.issue_codes, ("ISSUE_DATE_NOT_EXTRACTED",))

    def test_detection_variant_with_anchor_evidence_wins(self):
        calls = []

        def word_reader(_image, variant, _config):
            calls.append(variant)
            return _empty_data() if variant == "grayscale" else _valid_word_data()

        result = extract_indigency_core_fields(
            self.image,
            word_reader=word_reader,
            field_reader=_field_reader,
        )

        self.assertEqual(calls, ["grayscale", "otsu_threshold"])
        self.assertEqual(result.data.detection_variant, "otsu_threshold")
        self.assertTrue(all(field.detection_variant == "otsu_threshold" for field in result.data.fields))

    def test_one_failed_detection_variant_does_not_discard_valid_variant(self):
        def word_reader(_image, variant, _config):
            if variant == "grayscale":
                raise RuntimeError("synthetic reader failure")
            return _valid_word_data()

        result = extract_indigency_core_fields(
            self.image,
            word_reader=word_reader,
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.detection_variant, "otsu_threshold")

    def test_field_crops_use_owned_source_pixels(self):
        original = self.image.copy()
        observed = []

        def reader(crop, field_name):
            observed.append((crop.ndim, crop.shape[2], bool(np.all(crop == 240))))
            crop[:] = 0
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=reader,
        )

        self.assertTrue(result.success)
        self.assertTrue(all(item == (3, 3, True) for item in observed))
        self.assertTrue(np.array_equal(self.image, original))

    def test_anchor_metadata_is_immutable(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=_field_reader,
        )

        self.assertIsInstance(result.data.anchor_metadata, MappingProxyType)
        with self.assertRaises(TypeError):
            result.data.anchor_metadata["issuing_barangay"] = {}
        with self.assertRaises(TypeError):
            result.data.anchor_metadata["issuing_barangay"]["anchor"] = "changed"

    @patch(
        "extraction.indigency_core_field_extraction._estimate_deskew_angle",
        return_value=4.5,
    )
    def test_elevated_deskew_is_review_warning(self, _mock_angle):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertIn("DOCUMENT_DESKEW_ELEVATED", {issue["code"] for issue in result.issues})

    def test_invalid_word_data_fails_without_fields(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: {"text": ["invalid"]},
            field_reader=_field_reader,
        )

        self.assertFalse(result.success)
        self.assertIsNone(result.data)
        self.assertEqual(result.issues[0]["code"], "INDIGENCY_WORD_DATA_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
