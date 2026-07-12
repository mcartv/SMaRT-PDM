import unittest
from unittest.mock import patch

import job_worker


class JobWorkerTest(unittest.TestCase):
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_run_scan_adds_extracted_fields_without_removing_existing_payload(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-1",
                "application_id": "app-1",
                "student_id": "stud-1",
                "student_name": "Jane Doe",
                "document_key": "certificate_of_live_birth",
                "document_type": "Birth Certificate",
            }
        )

        self.assertTrue(success)
        self.assertEqual(
            set(payload.keys()),
            {"status", "raw_text", "ocr_confidence", "extracted_fields", "source_payload", "error_message"},
        )
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertEqual(payload["source_payload"]["document_contract_status"], "approved")
        self.assertEqual(payload["extracted_fields"]["document_type"], "birth_certificate")
        mock_clear_tmp_files.assert_called_once()

    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_unknown_document_key_is_safe_and_returns_review_payload(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-2",
                "application_id": "app-2",
                "student_id": "stud-2",
                "student_name": "Jane Doe",
                "document_key": "unknown_key",
                "document_type": "Unknown Document",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["extracted_fields"]["document_type"], "unknown_document")
        self.assertTrue(payload["extracted_fields"]["review_required"])
        self.assertEqual(payload["source_payload"]["document_contract_status"], "missing")
        mock_clear_tmp_files.assert_called_once()

    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_failed_contract_resolution_does_not_crash_worker_path(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.return_value.returncode = 1
        mock_read_text_file.side_effect = ["", ""]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-3",
                "application_id": "app-3",
                "student_id": "stud-3",
                "student_name": "Jane Doe",
                "document_key": "",
                "document_type": "",
            }
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["extracted_fields"]["document_type"], "unknown_document")
        self.assertTrue(payload["extracted_fields"]["review_required"])
        mock_clear_tmp_files.assert_called_once()


if __name__ == "__main__":
    unittest.main()
