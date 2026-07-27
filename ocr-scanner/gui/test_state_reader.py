import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from gui.state_reader import StateReader


class StateReaderTest(unittest.TestCase):
    def _write_state(self, path: Path, *, updated_at: str) -> None:
        payload = {
            "schema_version": 1,
            "sequence": 7,
            "worker_state": "waiting_for_capture",
            "request_reference": "5024d1f5…e8b5",
            "application_reference": "PDM-2026-••••43",
            "document_key": "student_grade_forms",
            "document_label": "Grade Report",
            "camera_status": "preview_active",
            "safe_message": "Align the document and press the physical capture button.",
            "failure_stage": None,
            "safe_error_code": None,
            "updated_at": updated_at,
            "student_name": "must never be surfaced",
            "raw_text": "must never be surfaced",
        }
        path.write_text(json.dumps(payload), encoding="utf-8")
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass

    def test_reads_only_allowlisted_operational_fields(self):
        now = datetime(2026, 7, 26, 5, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ocr_state.json"
            self._write_state(path, updated_at=now.isoformat())
            result = StateReader(
                state_path=path,
                now_provider=lambda: now,
                require_private_permissions=False,
            ).read()

            self.assertEqual(result.status, "available")
            self.assertIsNotNone(result.snapshot)
            self.assertNotIn("student_name", result.snapshot)
            self.assertNotIn("raw_text", result.snapshot)
            self.assertEqual(result.snapshot["document_label"], "Grade Report")

    def test_missing_file_is_reported_without_exception(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "missing.json"
            result = StateReader(
                state_path=path,
                require_private_permissions=False,
            ).read()
            self.assertEqual(result.status, "missing")
            self.assertEqual(result.error_code, "state_file_missing")

    def test_invalid_json_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ocr_state.json"
            path.write_text("{", encoding="utf-8")
            result = StateReader(
                state_path=path,
                require_private_permissions=False,
            ).read()
            self.assertEqual(result.status, "invalid")
            self.assertEqual(result.error_code, "state_json_invalid")

    def test_stale_heartbeat_is_reported(self):
        now = datetime(2026, 7, 26, 5, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ocr_state.json"
            self._write_state(
                path,
                updated_at=(now - timedelta(seconds=30)).isoformat(),
            )
            result = StateReader(
                state_path=path,
                stale_after_seconds=15,
                now_provider=lambda: now,
                require_private_permissions=False,
            ).read()
            self.assertEqual(result.status, "stale")
            self.assertTrue(result.available)

    def test_unknown_worker_state_is_rejected(self):
        now = datetime.now(timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ocr_state.json"
            self._write_state(path, updated_at=now.isoformat())
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload["worker_state"] = "manual_capture_button"
            path.write_text(json.dumps(payload), encoding="utf-8")
            result = StateReader(
                state_path=path,
                require_private_permissions=False,
            ).read()
            self.assertEqual(result.status, "invalid")
            self.assertEqual(result.error_code, "state_contract_invalid")


if __name__ == "__main__":
    unittest.main()
