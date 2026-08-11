import unittest

from types import SimpleNamespace

from document_contracts import (
    build_birth_extracted_fields_from_ocr_result,
    build_extracted_fields,
    build_indigency_extracted_fields_from_result,
    get_contract,
)


class DocumentContractsTest(unittest.TestCase):
    def test_birth_aliases_resolve_to_same_contract(self):
        aliases = [
            "birth_certificate",
            "certificate_of_live_birth",
            "psa_birth_certificate",
            "certificate_of_birth",
        ]
        contracts = [get_contract(alias) for alias in aliases]

        self.assertTrue(all(contract is not None for contract in contracts))
        self.assertEqual({id(contract) for contract in contracts}, {id(contracts[0])})
        self.assertEqual(contracts[0].document_key, "certificate_of_live_birth")

    def test_unknown_key_returns_review_payload(self):
        payload = build_extracted_fields("unknown_key", "sample text")

        self.assertEqual(payload["document_type"], "unknown_document")
        self.assertTrue(payload["review_required"])
        self.assertEqual(payload["contract_status"], "missing")
        self.assertEqual(payload["fields"], {})

    def test_missing_key_returns_review_payload(self):
        payload = build_extracted_fields("", "sample text")

        self.assertEqual(payload["document_type"], "unknown_document")
        self.assertTrue(payload["review_required"])
        self.assertEqual(payload["contract_status"], "missing")

    def test_birth_contract_returns_expected_shape_only(self):
        payload = build_extracted_fields("certificate_of_live_birth", "any text")

        self.assertEqual(payload["document_type"], "birth_certificate")
        self.assertTrue(payload["review_required"])
        self.assertEqual(payload["contract_status"], "approved")
        self.assertEqual(payload["source_regions"], ["Item 1", "Item 6", "Item 13"])
        self.assertEqual(
            payload["fields"],
            {
                "child_name": {"first_name": "", "middle_name": "", "last_name": ""},
                "mother_maiden_name": {"first_name": "", "middle_name": "", "last_name": ""},
                "father_name": {"first_name": "", "middle_name": "", "last_name": ""},
            },
        )

    def test_pending_documents_are_explicitly_marked_for_review(self):
        for key in ("student_grade_forms",):
            with self.subTest(key=key):
                payload = build_extracted_fields(key, "sample text")
                self.assertTrue(payload["review_required"])
                self.assertEqual(payload["contract_status"], "pending_approval")
                self.assertEqual(payload["fields"], {})

    def test_indigency_contract_does_not_fabricate_structured_fields(self):
        payload = build_extracted_fields(
            "certificate_of_indigency",
            "RAW OCR MUST REMAIN OUTSIDE STRUCTURED FIELDS",
        )

        self.assertEqual(payload["document_type"], "certificate_of_indigency")
        self.assertTrue(payload["review_required"])
        self.assertEqual(payload["contract_status"], "approved")
        self.assertEqual(payload["fields"], {})
        self.assertNotIn("name", payload)
        self.assertNotIn("extracted_name", payload)

    def test_indigency_aliases_resolve_to_approved_subject_contract(self):
        contracts = [get_contract(key) for key in ("certificate_of_indigency", "indigency")]

        self.assertEqual({id(contract) for contract in contracts}, {id(contracts[0])})
        self.assertEqual(contracts[0].document_key, "certificate_of_indigency")
        self.assertEqual(contracts[0].status, "approved")
        self.assertEqual(
            [field.name for field in contracts[0].fields],
            [
                "certificate_subject_name",
                "residency_address",
            ],
        )

    def test_indigency_result_uses_only_approved_ocr_fields(self):
        fields = tuple(
            SimpleNamespace(
                name=name,
                raw_text=value,
                success=bool(value),
                issue_codes=() if value else ("ISSUE_DATE_NOT_EXTRACTED",),
                detection_variant="otsu_threshold",
                anchor="synthetic anchor",
                normalized_bounds=(0.1, 0.2, 0.3, 0.1) if value else None,
            )
            for name, value in (
                ("certificate_subject_name", "SUBJECT OCR"),
                ("residency_address", "12 SAMPLE STREET MARILAO BULACAN"),
                ("issue_date", ""),
                ("issuing_barangay", "SAMPLE BARANGAY"),
            )
        )
        extraction_result = SimpleNamespace(
            data=SimpleNamespace(fields=fields, detection_variant="otsu_threshold")
        )

        payload = build_indigency_extracted_fields_from_result(
            "RAW DOCUMENT OCR",
            extraction_result,
        )

        self.assertEqual(payload["contract_status"], "approved")
        self.assertTrue(payload["review_required"])
        self.assertEqual(
            tuple(payload["fields"]),
            (
                "certificate_subject_name",
                "residency_address",
            ),
        )

    def test_birth_ocr_candidate_preserves_parsed_name_components(self):
        payload = build_birth_extracted_fields_from_ocr_result(
            "JUAN S DELA CRUZ\nMARIA R SANTOS\nPEDRO M DELA CRUZ",
            {
                "child_name": {
                    "raw_text": "JUAN S DELA CRUZ",
                    "components": {
                        "first_name": "JUAN",
                        "middle_name": "S",
                        "last_name": "DELA CRUZ",
                    },
                    "section_status": "present",
                    "confidence": 92.5,
                    "component_confidence": {
                        "first_name": 95.0,
                        "middle_name": 88.0,
                        "last_name": 94.5,
                    },
                    "component_raw_text": {
                        "first_name": "JUAN",
                        "middle_name": "S",
                        "last_name": "DELA CRUZ",
                    },
                },
                "mother_maiden_name": {
                    "raw_text": "MARIA R SANTOS",
                    "components": {
                        "first_name": "MARIA",
                        "middle_name": "R",
                        "last_name": "SANTOS",
                    },
                    "section_status": "present",
                },
            },
        )

        self.assertEqual(
            payload["fields"]["mother_maiden_name"]["components"],
            {"first_name": "MARIA", "middle_name": "R", "last_name": "SANTOS"},
        )
        self.assertEqual(payload["fields"]["child_name"]["section_status"], "present")
        self.assertEqual(payload["fields"]["child_name"]["confidence"], 92.5)
        self.assertEqual(
            payload["fields"]["child_name"]["component_confidence"]["last_name"],
            94.5,
        )
        self.assertNotIn("issue_date", payload["fields"])
        self.assertNotIn("issuing_barangay", payload["fields"])
        self.assertNotIn("applicant_name", payload["fields"])
        self.assertNotIn("extracted_name", payload["fields"])

    def test_indigency_contract_drops_barangay_diagnostics(self):
        diagnostics = SimpleNamespace(
            candidate_found=True,
            candidate_count=1,
            candidate_token_count=2,
            candidate_word_confidences=(91.25, 43.5),
            candidate_horizontal_gaps=(37,),
            candidate_gap_ratios=(1.321,),
            candidate_word_count_before_filter=2,
            candidate_word_count_after_filter=2,
            token_filter_status="unchanged",
            removed_token_count=0,
            candidate_source="pre_title_header",
            anchor_found=True,
            bounds_present=True,
            crop_attempted=True,
            crop_returned_text=True,
            value_source="positional",
            positional_validation_status="valid",
            crop_validation_status="not_attempted",
            failure_stage="none",
            candidate_text="MUST NOT PERSIST",
            crop_text="MUST NOT PERSIST",
            raw_text="MUST NOT PERSIST",
        )
        field = SimpleNamespace(
            name="issuing_barangay",
            raw_text="SYNTHETIC FIELD OUTPUT",
            success=True,
            issue_codes=(),
            detection_variant="grayscale",
            anchor="SYNTHETIC ANCHOR",
            normalized_bounds=(0.1, 0.2, 0.3, 0.1),
            diagnostics=diagnostics,
        )
        extraction_result = SimpleNamespace(
            data=SimpleNamespace(fields=(field,), detection_variant="grayscale")
        )

        payload = build_indigency_extracted_fields_from_result(
            "SYNTHETIC RAW OCR",
            extraction_result,
        )
        self.assertNotIn("issuing_barangay", payload["fields"])

    def test_indigency_contract_drops_mapping_barangay_diagnostics(self):
        diagnostics = {
            "candidate_found": True,
            "candidate_count": 1,
            "candidate_token_count": 2,
            "candidate_word_confidences": (91.25, 43.5),
            "candidate_horizontal_gaps": (37,),
            "candidate_gap_ratios": (1.321,),
            "candidate_word_count_before_filter": 2,
            "candidate_word_count_after_filter": 2,
            "token_filter_status": "unchanged",
            "removed_token_count": 0,
            "candidate_source": "pre_title_header",
            "anchor_found": True,
            "bounds_present": True,
            "crop_attempted": False,
            "crop_returned_text": False,
            "value_source": "positional",
            "positional_validation_status": "valid",
            "crop_validation_status": "not_attempted",
            "failure_stage": "none",
        }
        field = SimpleNamespace(
            name="issuing_barangay",
            raw_text="SYNTHETIC",
            success=True,
            issue_codes=(),
            detection_variant="grayscale",
            anchor="SYNTHETIC",
            normalized_bounds=(0.1, 0.2, 0.3, 0.1),
            diagnostics=diagnostics,
        )
        extraction_result = SimpleNamespace(
            data=SimpleNamespace(fields=(field,), detection_variant="grayscale")
        )

        payload = build_indigency_extracted_fields_from_result(
            "SYNTHETIC RAW OCR",
            extraction_result,
        )
        self.assertNotIn("issuing_barangay", payload["fields"])

    def test_indigency_contract_drops_legacy_barangay_diagnostics(self):
        diagnostics = SimpleNamespace(
            candidate_found=True,
            candidate_count=1,
            candidate_token_count=2,
            candidate_word_confidences=(),
            candidate_horizontal_gaps=(),
            candidate_word_count_before_filter=0,
            candidate_word_count_after_filter=0,
            candidate_source="pre_title_header",
            anchor_found=True,
            bounds_present=True,
            crop_attempted=True,
            crop_returned_text=True,
            value_source="crop_ocr",
            positional_validation_status="not_implemented",
            crop_validation_status="non_empty_accepted",
            failure_stage="none",
        )
        field = SimpleNamespace(
            name="issuing_barangay",
            raw_text="SYNTHETIC",
            success=True,
            issue_codes=(),
            detection_variant="grayscale",
            anchor="SYNTHETIC",
            normalized_bounds=(0.1, 0.2, 0.3, 0.1),
            diagnostics=diagnostics,
        )
        extraction_result = SimpleNamespace(
            data=SimpleNamespace(fields=(field,), detection_variant="grayscale")
        )

        payload = build_indigency_extracted_fields_from_result(
            "SYNTHETIC RAW OCR",
            extraction_result,
        )
        self.assertNotIn("issuing_barangay", payload["fields"])

    def test_mutating_one_result_does_not_affect_next_result(self):
        first = build_extracted_fields("certificate_of_live_birth", "sample text")
        first["source_regions"].append("MUTATED")
        first["fields"]["child_name"]["first_name"] = "Changed"

        second = build_extracted_fields("certificate_of_live_birth", "sample text")

        self.assertEqual(second["source_regions"], ["Item 1", "Item 6", "Item 13"])
        self.assertEqual(
            second["fields"]["child_name"],
            {"first_name": "", "middle_name": "", "last_name": ""},
        )


if __name__ == "__main__":
    unittest.main()
