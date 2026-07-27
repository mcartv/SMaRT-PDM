import unittest

from gui.state_reader import ReadResult
from gui.view_model import build_view_model


class ViewModelTest(unittest.TestCase):
    def _snapshot(self, worker_state: str):
        return {
            "schema_version": 1,
            "sequence": 2,
            "worker_state": worker_state,
            "request_reference": "5024d1f5…e8b5",
            "application_reference": "PDM-2026-••••43",
            "document_key": "student_grade_forms",
            "document_label": "Grade Report",
            "camera_status": "preview_active",
            "safe_message": "Controlled operational message.",
            "failure_stage": None,
            "safe_error_code": None,
            "updated_at": "2026-07-26T05:00:00Z",
        }

    def test_waiting_for_capture_is_prominent(self):
        model = build_view_model(
            ReadResult(status="available", snapshot=self._snapshot("waiting_for_capture"))
        )
        self.assertEqual(model.title, "Ready to capture")
        self.assertEqual(model.tone, "attention")
        self.assertEqual(model.progress_percent, 32)
        self.assertEqual(model.camera_label, "Preview active")

    def test_completed_reaches_full_progress(self):
        model = build_view_model(
            ReadResult(status="available", snapshot=self._snapshot("completed"))
        )
        self.assertEqual(model.title, "Processing completed")
        self.assertEqual(model.progress_percent, 100)
        self.assertEqual(model.tone, "success")

    def test_missing_state_returns_offline_model(self):
        model = build_view_model(
            ReadResult(status="missing", error_code="state_file_missing")
        )
        self.assertEqual(model.title, "Waiting for worker")
        self.assertEqual(model.connection_status, "Worker offline")
        self.assertFalse(model.show_request_panel)

    def test_stale_state_never_claims_worker_is_online(self):
        model = build_view_model(
            ReadResult(status="stale", snapshot=self._snapshot("running_ocr"))
        )
        self.assertEqual(model.connection_status, "Worker connection stale")
        self.assertEqual(model.tone, "danger")

    def test_model_contains_only_masked_references(self):
        model = build_view_model(
            ReadResult(status="available", snapshot=self._snapshot("request_claimed"))
        )
        self.assertEqual(model.application_reference, "PDM-2026-••••43")
        self.assertEqual(model.request_reference, "5024d1f5…e8b5")


if __name__ == "__main__":
    unittest.main()
