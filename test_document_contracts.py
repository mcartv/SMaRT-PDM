import unittest

from document_contracts import build_extracted_fields, get_contract


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
        for key in ("certificate_of_indigency", "student_grade_forms"):
            with self.subTest(key=key):
                payload = build_extracted_fields(key, "sample text")
                self.assertTrue(payload["review_required"])
                self.assertEqual(payload["contract_status"], "pending_approval")
                self.assertEqual(payload["fields"], {})

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
