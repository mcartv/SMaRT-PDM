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
    date_text="Given this 16th day of July 2026 at the barangay office.",
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
        date_text,
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


ORIENTATION_ORDER = (
    "original",
    "clockwise_90",
    "counterclockwise_90",
    "180",
)


def _orientation_reader(winner, *, winner_data=None, other_data=None):
    calls = []

    def reader(_image, variant, _config):
        orientation = ORIENTATION_ORDER[len(calls) // 2]
        calls.append((orientation, variant))
        if orientation == winner:
            return winner_data if winner_data is not None else _valid_word_data()
        return other_data if other_data is not None else _empty_data()

    return reader, calls


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
        diagnostics = fields["issuing_barangay"].diagnostics
        self.assertTrue(diagnostics.candidate_found)
        self.assertEqual(diagnostics.candidate_count, 1)
        self.assertEqual(diagnostics.candidate_source, "pre_title_header")
        self.assertEqual(diagnostics.value_source, "positional")
        self.assertEqual(diagnostics.positional_validation_status, "valid")
        self.assertFalse(diagnostics.crop_attempted)
        self.assertEqual(diagnostics.crop_validation_status, "not_attempted")
        self.assertEqual(diagnostics.failure_stage, "none")

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
        diagnostics = field.diagnostics
        self.assertFalse(diagnostics.candidate_found)
        self.assertEqual(diagnostics.candidate_count, 0)
        self.assertEqual(diagnostics.candidate_source, "none")
        self.assertEqual(diagnostics.value_source, "none")
        self.assertEqual(diagnostics.positional_validation_status, "not_attempted")
        self.assertFalse(diagnostics.bounds_present)
        self.assertFalse(diagnostics.crop_attempted)
        self.assertEqual(diagnostics.crop_validation_status, "not_attempted")
        self.assertEqual(diagnostics.failure_stage, "candidate_selection")

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
        diagnostics = field.diagnostics
        self.assertTrue(diagnostics.candidate_found)
        self.assertEqual(diagnostics.candidate_count, 2)
        self.assertEqual(diagnostics.candidate_token_count, 0)
        self.assertEqual(diagnostics.candidate_source, "ambiguous")
        self.assertEqual(diagnostics.value_source, "none")
        self.assertEqual(diagnostics.positional_validation_status, "not_attempted")
        self.assertTrue(diagnostics.anchor_found)
        self.assertFalse(diagnostics.crop_attempted)
        self.assertEqual(diagnostics.failure_stage, "candidate_selection")

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

    def test_valid_positional_day_of_month_date_does_not_use_crop_ocr(self):
        calls = []

        def reader(crop, field_name):
            calls.append(field_name)
            if field_name == "issue_date":
                raise AssertionError("valid positional date must not be re-read")
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text="Given this 16 day of July 2026 at the barangay office."
            ),
            field_reader=reader,
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertTrue(issue_date.success)
        self.assertEqual(issue_date.raw_text, "16 day of July 2026")
        self.assertNotIn("issue_date", calls)

    def test_valid_positional_month_day_year_does_not_use_crop_ocr(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text="Issued this July 16, 2026 at the barangay office."
            ),
            field_reader=lambda crop, field_name: (
                "invalid crop date"
                if field_name == "issue_date"
                else _field_reader(crop, field_name)
            ),
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertTrue(issue_date.success)
        self.assertEqual(issue_date.raw_text, "July 16 2026")

    def test_positional_date_strips_trailing_month_or_year_commas(self):
        cases = (
            (
                "Given this 16th day of July, 2026 at the barangay office.",
                "16th day of July 2026",
            ),
            (
                "Given this 16th day of July 2026, at the barangay office.",
                "16th day of July 2026",
            ),
        )
        for positional_line, expected in cases:
            with self.subTest(positional_line=positional_line):
                result = extract_indigency_core_fields(
                    self.image,
                    word_reader=lambda *_args, value=positional_line: (
                        _valid_word_data(date_text=value)
                    ),
                    field_reader=lambda crop, field_name: (
                        "invalid crop date"
                        if field_name == "issue_date"
                        else _field_reader(crop, field_name)
                    ),
                )
                issue_date = next(
                    field
                    for field in result.data.fields
                    if field.name == "issue_date"
                )

                self.assertTrue(issue_date.success)
                self.assertEqual(issue_date.raw_text, expected)

    def test_positional_date_strips_only_leading_and_trailing_punctuation(self):
        calls = []

        def reader(crop, field_name):
            calls.append(field_name)
            if field_name == "issue_date":
                raise AssertionError("sanitized positional date must be primary")
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text=(
                    "Given this [16th] /day/ (of) 'JuLy' <2026> "
                    "at the barangay office."
                )
            ),
            field_reader=reader,
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertTrue(issue_date.success)
        self.assertEqual(issue_date.raw_text, "16th day of JuLy 2026")
        self.assertNotIn("issue_date", calls)

    def test_internal_invalid_date_characters_are_not_corrected(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text="Given this 16th day of July 20-26 at the office."
            ),
            field_reader=lambda crop, field_name: (
                "still invalid"
                if field_name == "issue_date"
                else _field_reader(crop, field_name)
            ),
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertFalse(issue_date.success)
        self.assertEqual(issue_date.raw_text, "")
        self.assertEqual(issue_date.issue_codes, ("ISSUE_DATE_NOT_EXTRACTED",))

    def test_invalid_positional_date_uses_valid_crop_ocr_fallback(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text="Given this unreadable date at the barangay office."
            ),
            field_reader=_field_reader,
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertTrue(issue_date.success)
        self.assertEqual(issue_date.raw_text, "16th day of July 2026")

    def test_both_positional_and_crop_dates_invalid_remains_unextracted(self):
        def reader(crop, field_name):
            if field_name == "issue_date":
                return "32nd day of Smarch 20X6"
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text="Given this unreadable date at the barangay office."
            ),
            field_reader=reader,
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertFalse(issue_date.success)
        self.assertEqual(issue_date.raw_text, "")
        self.assertEqual(issue_date.issue_codes, ("ISSUE_DATE_NOT_EXTRACTED",))

    def test_invalid_calendar_date_is_rejected_from_both_sources(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                date_text="Given this 31st day of February 2026 at the office."
            ),
            field_reader=lambda crop, field_name: (
                "February 31, 2026"
                if field_name == "issue_date"
                else _field_reader(crop, field_name)
            ),
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertFalse(issue_date.success)
        self.assertEqual(issue_date.issue_codes, ("ISSUE_DATE_NOT_EXTRACTED",))

    def test_multiple_date_anchors_remain_ambiguous(self):
        data = _valid_word_data()
        _add_line(
            data,
            "Issued this July 17 2026 at the barangay office.",
            y=740,
            block=6,
            paragraph=1,
            line=1,
        )

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: data,
            field_reader=_field_reader,
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertFalse(issue_date.success)
        self.assertIn(
            {
                "code": "FIELD_ANCHOR_AMBIGUOUS",
                "stage": "indigency_core_field_extraction",
                "field": "issue_date",
            },
            result.issues,
        )

    def test_barangay_candidate_with_empty_crop_ocr_preserves_context(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="BARANGAY 123"
            ),
            field_reader=lambda crop, field_name: (
                ""
                if field_name == "issuing_barangay"
                else _field_reader(crop, field_name)
            ),
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        self.assertFalse(field.success)
        self.assertTrue(field.anchor)
        self.assertIsNotNone(field.normalized_bounds)
        self.assertEqual(field.issue_codes, ("ISSUING_BARANGAY_NOT_EXTRACTED",))
        diagnostics = field.diagnostics
        self.assertTrue(diagnostics.candidate_found)
        self.assertEqual(diagnostics.candidate_count, 1)
        self.assertGreater(diagnostics.candidate_token_count, 0)
        self.assertTrue(diagnostics.anchor_found)
        self.assertTrue(diagnostics.bounds_present)
        self.assertTrue(diagnostics.crop_attempted)
        self.assertFalse(diagnostics.crop_returned_text)
        self.assertEqual(diagnostics.value_source, "none")
        self.assertEqual(diagnostics.positional_validation_status, "invalid")
        self.assertEqual(diagnostics.crop_validation_status, "empty")
        self.assertEqual(diagnostics.failure_stage, "crop_ocr")

    def test_barangay_candidate_with_crop_exception_preserves_context(self):
        def reader(crop, field_name):
            if field_name == "issuing_barangay":
                raise RuntimeError("synthetic crop reader failure")
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="BARANGAY 123"
            ),
            field_reader=reader,
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        self.assertFalse(field.success)
        self.assertTrue(field.anchor)
        self.assertIsNotNone(field.normalized_bounds)
        diagnostics = field.diagnostics
        self.assertTrue(diagnostics.crop_attempted)
        self.assertFalse(diagnostics.crop_returned_text)
        self.assertEqual(diagnostics.value_source, "none")
        self.assertEqual(diagnostics.positional_validation_status, "invalid")
        self.assertEqual(diagnostics.crop_validation_status, "exception")
        self.assertEqual(diagnostics.failure_stage, "crop_ocr")

    def test_invalid_non_empty_barangay_crop_is_rejected(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="BARANGAY 123"
            ),
            field_reader=lambda crop, field_name: (
                "4567"
                if field_name == "issuing_barangay"
                else _field_reader(crop, field_name)
            ),
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        self.assertFalse(field.success)
        self.assertEqual(field.raw_text, "")
        diagnostics = field.diagnostics
        self.assertTrue(diagnostics.crop_returned_text)
        self.assertEqual(diagnostics.value_source, "none")
        self.assertEqual(diagnostics.positional_validation_status, "invalid")
        self.assertEqual(diagnostics.crop_validation_status, "invalid")
        self.assertEqual(diagnostics.failure_stage, "crop_ocr")

    def test_valid_positional_barangay_bypasses_crop_ocr(self):
        calls = []

        def reader(crop, field_name):
            calls.append(field_name)
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="BARANGAY [Sample-Place] 'O'Name,'"
            ),
            field_reader=reader,
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        self.assertTrue(field.success)
        self.assertEqual(field.raw_text, "Sample-Place O'Name")
        self.assertNotIn("issuing_barangay", calls)
        self.assertEqual(field.diagnostics.value_source, "positional")
        self.assertEqual(field.diagnostics.positional_validation_status, "valid")

    def test_barangay_candidate_diagnostics_are_numeric_only(self):
        data = _valid_word_data(header_text="BARANGAY SAMPLE TRAILING")
        header_indexes = [
            index
            for index, block in enumerate(data["block_num"])
            if block == 2 and data["par_num"][index] == 1
        ]
        data["conf"][header_indexes[-2]] = 91.25
        data["conf"][header_indexes[-1]] = 43.5
        data["left"][header_indexes[-1]] += 37

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: data,
            field_reader=_field_reader,
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )
        diagnostics = field.diagnostics

        self.assertEqual(diagnostics.candidate_word_confidences, (91.25, 43.5))
        self.assertEqual(len(diagnostics.candidate_horizontal_gaps), 1)
        self.assertGreater(diagnostics.candidate_horizontal_gaps[0], 12)
        self.assertEqual(diagnostics.candidate_word_count_before_filter, 2)
        self.assertEqual(diagnostics.candidate_word_count_after_filter, 2)
        self.assertTrue(
            all(
                isinstance(value, (int, float))
                for values in (
                    diagnostics.candidate_word_confidences,
                    diagnostics.candidate_horizontal_gaps,
                )
                for value in values
            )
        )

    def test_invalid_positional_barangay_uses_valid_crop_fallback(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="BARANGAY 123"
            ),
            field_reader=lambda crop, field_name: (
                "Sample-Place O'Name"
                if field_name == "issuing_barangay"
                else _field_reader(crop, field_name)
            ),
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        self.assertTrue(field.success)
        self.assertEqual(field.raw_text, "Sample-Place O'Name")
        self.assertEqual(field.diagnostics.value_source, "crop_ocr")
        self.assertEqual(field.diagnostics.positional_validation_status, "invalid")
        self.assertEqual(field.diagnostics.crop_validation_status, "valid")

    def test_barangay_length_boundary_accepts_80_and_rejects_81(self):
        for length, expected_success in ((80, True), (81, False)):
            with self.subTest(length=length):
                result = extract_indigency_core_fields(
                    self.image,
                    word_reader=lambda *_args, size=length: _valid_word_data(
                        header_text=f"BARANGAY {'A' * size}"
                    ),
                    field_reader=lambda crop, field_name: (
                        "123"
                        if field_name == "issuing_barangay"
                        else _field_reader(crop, field_name)
                    ),
                )
                field = next(
                    item
                    for item in result.data.fields
                    if item.name == "issuing_barangay"
                )

                self.assertEqual(field.success, expected_success)
                if expected_success:
                    self.assertEqual(len(field.raw_text), 80)
                    self.assertEqual(field.diagnostics.value_source, "positional")
                else:
                    self.assertEqual(field.raw_text, "")
                    self.assertEqual(
                        field.diagnostics.positional_validation_status,
                        "invalid",
                    )

    def test_anchor_only_punctuation_only_and_whitespace_only_are_rejected(self):
        for header in (
            "BARANGAY",
            "BARANGAY Barangay",
            "BARANGAY ---",
            "BARANGAY    ",
        ):
            with self.subTest(header=header):
                result = extract_indigency_core_fields(
                    self.image,
                    word_reader=lambda *_args, value=header: _valid_word_data(
                        header_text=value
                    ),
                    field_reader=lambda crop, field_name: (
                        "123"
                        if field_name == "issuing_barangay"
                        else _field_reader(crop, field_name)
                    ),
                )
                field = next(
                    item
                    for item in result.data.fields
                    if item.name == "issuing_barangay"
                )

                self.assertFalse(field.success)
                self.assertEqual(field.raw_text, "")
                self.assertEqual(field.diagnostics.value_source, "none")

    def test_barangay_control_characters_are_rejected(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(
                header_text="BARANGAY Sample\x00Place"
            ),
            field_reader=lambda crop, field_name: (
                "Other\x00Place"
                if field_name == "issuing_barangay"
                else _field_reader(crop, field_name)
            ),
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        self.assertFalse(field.success)
        self.assertEqual(field.raw_text, "")
        self.assertEqual(field.diagnostics.positional_validation_status, "invalid")
        self.assertEqual(field.diagnostics.crop_validation_status, "invalid")

    def test_barangay_diagnostics_are_immutable(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=_field_reader,
        )
        field = next(
            item for item in result.data.fields if item.name == "issuing_barangay"
        )

        with self.assertRaisesRegex(Exception, "cannot assign"):
            field.diagnostics.failure_stage = "crop_ocr"

    def test_positional_date_preserves_selected_orientation_metadata(self):
        reader, _calls = _orientation_reader("180")

        result = extract_indigency_core_fields(
            self.image,
            word_reader=reader,
            field_reader=_field_reader,
        )
        issue_date = next(
            field for field in result.data.fields if field.name == "issue_date"
        )

        self.assertTrue(issue_date.success)
        self.assertEqual(result.data.selected_orientation, "180")
        self.assertEqual(result.data.candidate_count, 8)
        self.assertEqual(issue_date.anchor, "given this")
        self.assertIsNotNone(issue_date.normalized_bounds)
        self.assertEqual(
            issue_date.detection_variant,
            result.data.selected_detection_variant,
        )

    def test_positional_date_does_not_change_subject_or_barangay_reading(self):
        calls = []

        def reader(crop, field_name):
            calls.append(field_name)
            return _field_reader(crop, field_name)

        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=reader,
        )
        fields = {field.name: field for field in result.data.fields}

        self.assertEqual(
            calls,
            ["certificate_subject_name"],
        )
        self.assertEqual(
            fields["certificate_subject_name"].raw_text,
            "SAMPLE SUBJECT,",
        )
        self.assertEqual(fields["issuing_barangay"].raw_text, "SAMPLE II")

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

        self.assertEqual(
            calls,
            ["grayscale", "otsu_threshold"] * len(ORIENTATION_ORDER),
        )
        self.assertEqual(result.data.detection_variant, "otsu_threshold")
        self.assertTrue(all(field.detection_variant == "otsu_threshold" for field in result.data.fields))

    def test_landscape_sensor_image_with_upright_content_selects_original(self):
        image = np.full((1944, 2592, 3), 240, dtype=np.uint8)
        reader, calls = _orientation_reader("original")

        result = extract_indigency_core_fields(
            image,
            word_reader=reader,
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.selected_orientation, "original")
        self.assertEqual(result.data.candidate_count, 8)
        self.assertEqual(len(calls), 8)

    def test_clockwise_document_selects_counterclockwise_correction(self):
        reader, _calls = _orientation_reader("counterclockwise_90")

        result = extract_indigency_core_fields(
            self.image,
            word_reader=reader,
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.selected_orientation, "counterclockwise_90")

    def test_counterclockwise_document_selects_clockwise_correction(self):
        reader, _calls = _orientation_reader("clockwise_90")

        result = extract_indigency_core_fields(
            self.image,
            word_reader=reader,
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.selected_orientation, "clockwise_90")

    def test_upside_down_document_selects_180(self):
        reader, _calls = _orientation_reader("180")

        result = extract_indigency_core_fields(
            self.image,
            word_reader=reader,
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.selected_orientation, "180")

    def test_upper_zone_title_outranks_rotated_false_positive(self):
        false_positive = _valid_word_data(title_y=1200)
        for index in range(30):
            _add_line(
                false_positive,
                f"ADDITIONAL OCR WORDS {index}",
                y=1300 + index,
                block=20 + index,
                paragraph=1,
                line=1,
            )
        reader, _calls = _orientation_reader(
            "original",
            other_data=false_positive,
        )

        result = extract_indigency_core_fields(
            self.image,
            word_reader=reader,
            field_reader=_field_reader,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.data.selected_orientation, "original")

    def test_no_valid_orientation_returns_document_not_detected(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _empty_data(),
            field_reader=_field_reader,
        )

        self.assertFalse(result.success)
        self.assertEqual(result.issues[0]["code"], "INDIGENCY_DOCUMENT_NOT_DETECTED")
        self.assertEqual(result.metrics["candidate_count"], 8)

    def test_fields_are_read_once_from_selected_orientation(self):
        reader, _calls = _orientation_reader("counterclockwise_90")
        rows, columns = np.indices(self.image.shape[:2])
        image = np.stack(
            (rows % 251, columns % 251, (rows + columns) % 251),
            axis=-1,
        ).astype(np.uint8)
        field_calls = []

        def field_reader(crop, field_name):
            field_calls.append((field_name, crop.copy()))
            return _field_reader(crop, field_name)

        with patch(
            "extraction.indigency_core_field_extraction._estimate_deskew_angle",
            return_value=0.0,
        ):
            result = extract_indigency_core_fields(
                image,
                word_reader=reader,
                field_reader=field_reader,
            )

        self.assertTrue(result.success)
        self.assertEqual(result.data.selected_orientation, "counterclockwise_90")
        self.assertEqual(
            [name for name, _crop in field_calls],
            ["certificate_subject_name"],
        )
        selected_image = np.rot90(image, 1)
        selected_height, selected_width = selected_image.shape[:2]
        subject = result.data.fields[0]
        left = round(subject.normalized_bounds[0] * selected_width)
        top = round(subject.normalized_bounds[1] * selected_height)
        expected_top_left = selected_image[max(0, top - 4), max(0, left - 4)]
        np.testing.assert_array_equal(field_calls[0][1][0, 0], expected_top_left)
        self.assertEqual(result.metrics["selected_orientation"], "counterclockwise_90")
        self.assertEqual(
            result.metrics["selected_detection_variant"],
            result.data.selected_detection_variant,
        )

    def test_orientation_metadata_is_immutable_and_non_textual(self):
        result = extract_indigency_core_fields(
            self.image,
            word_reader=lambda *_args: _valid_word_data(),
            field_reader=_field_reader,
        )

        with self.assertRaisesRegex(Exception, "cannot assign"):
            result.data.selected_orientation = "180"
        self.assertEqual(result.metrics["candidate_count"], 8)
        self.assertNotIn("raw_text", result.metrics)
        self.assertNotIn("field_values", result.metrics)

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
