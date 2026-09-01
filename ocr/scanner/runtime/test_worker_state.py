import unittest

from runtime.worker_state import (
    SCHEMA_VERSION,
    build_worker_state,
    mask_reference,
    safe_document_label,
)


class WorkerStateContractTest(unittest.TestCase):
    def test_reference_masking_preserves_only_safe_fragments(self):
        self.assertEqual(mask_reference("PDM-2026-000043"), "PDM-2026-••••43")
        self.assertEqual(
            mask_reference("5024d1f5-7622-4848-843a-2323355fe8b5"),
            "5024d1f5…e8b5",
        )

    def test_uuid_reference_is_masked(self):
        masked = mask_reference("5024d1f5-7622-4848-843a-2323355fe8b5")
        self.assertEqual(masked, "5024d1f5…e8b5")
        self.assertNotIn("7622-4848", masked)

    def test_known_document_key_gets_controlled_label(self):
        self.assertEqual(
            safe_document_label("student_grade_forms"),
            "Grade Form",
        )
        self.assertEqual(safe_document_label("unexpected value"), "Document")

    def test_snapshot_contains_only_operational_contract_fields(self):
        snapshot = build_worker_state(
            sequence=4,
            worker_state="waiting_for_capture",
            request_reference="private-request-identifier",
            application_reference="PDM-2026-000043",
            document_key="student_grade_forms",
            request_owner_name="Venice Pelima",
            camera_status="preview_active",
        ).to_dict()

        self.assertEqual(snapshot["schema_version"], SCHEMA_VERSION)
        self.assertEqual(snapshot["worker_state"], "waiting_for_capture")
        self.assertEqual(snapshot["document_label"], "Grade Form")
        self.assertEqual(snapshot["request_owner_name"], "Venice Pelima")
        self.assertNotIn("student_name", snapshot)
        self.assertNotIn("raw_text", snapshot)
        self.assertNotIn("extracted_fields", snapshot)
        self.assertNotIn("private-request-identifier", str(snapshot))
        self.assertNotIn("PDM-2026-000043", str(snapshot))

    def test_invalid_worker_state_is_rejected(self):
        with self.assertRaises((KeyError, ValueError)):
            build_worker_state(
                sequence=1,
                worker_state="editing_extracted_fields",
            )


if __name__ == "__main__":
    unittest.main()
