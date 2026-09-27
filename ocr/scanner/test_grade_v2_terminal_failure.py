import unittest
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.modules.setdefault("api", SimpleNamespace(ApiClient=object))
import job_worker


class GradeV2TerminalFailureTest(unittest.TestCase):
    def test_provider_failure_with_terminal_backend_state_skips_late_result(self):
        api = SimpleNamespace(
            last_ocr_error=SimpleNamespace(
                code="ENHANCED_OCR_PROVIDER_FAILED",
                request_status="failed",
                capture_preserved=True,
            ),
            submit_grade_v2_artifact=lambda *_args: None,
        )
        request = {"request_id": "request-123", "document_key": "student_grade_forms"}

        with patch("job_worker.Path.read_bytes", return_value=b"capture"):
            success, payload = job_worker._run_grade_form_v2_scan(request, "capture.jpg", api)

        self.assertTrue(success)
        self.assertTrue(payload["_backend_terminal_acknowledged"])
        self.assertEqual(payload["status"], "failed")

    def test_unknown_completion_failure_stays_on_normal_failure_path(self):
        api = SimpleNamespace(
            last_ocr_error=SimpleNamespace(
                code=None,
                request_status=None,
                capture_preserved=False,
            ),
            submit_grade_v2_artifact=lambda *_args: None,
        )
        request = {"request_id": "request-123", "document_key": "student_grade_forms"}

        with patch("job_worker.Path.read_bytes", return_value=b"capture"):
            success, payload = job_worker._run_grade_form_v2_scan(request, "capture.jpg", api)

        self.assertFalse(success)
        self.assertEqual(payload["error_code"], "GRADE_V2_UPLOAD_FAILED")

    def test_terminal_acknowledgement_does_not_submit_a_result(self):
        class Api:
            def submit_result(self, *_args, **_kwargs):
                raise AssertionError("late result submission")

        self.assertTrue(job_worker.submit_and_verify(
            Api(),
            "request-123",
            {"status": "failed", "_backend_terminal_acknowledged": True},
        ))


if __name__ == "__main__":
    unittest.main()
