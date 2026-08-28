import json
import tempfile
import unittest
from pathlib import Path

from gui.state_reader import StateReader


class StateReaderTests(unittest.TestCase):
    def test_valid_device_state_is_available(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "device_state.json"
            path.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "device_id": "smartpdm-ocr-01",
                        "internet_status": "online",
                        "backend_status": "connected",
                        "worker_status": "ready",
                        "activity": "idle",
                        "reported_at": "2026-08-28T12:00:00Z",
                    }
                ),
                encoding="utf-8",
            )
            result = StateReader(
                state_path=path,
                require_private_permissions=False,
            ).read()
        self.assertEqual(result.status, "available")
        self.assertEqual(result.snapshot["internet_status"], "online")

    def test_invalid_enum_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "device_state.json"
            path.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "device_id": "smartpdm-ocr-01",
                        "internet_status": "maybe",
                        "backend_status": "connected",
                        "worker_status": "ready",
                        "activity": "idle",
                        "reported_at": "2026-08-28T12:00:00Z",
                    }
                ),
                encoding="utf-8",
            )
            result = StateReader(
                state_path=path,
                require_private_permissions=False,
            ).read()
        self.assertEqual(result.status, "invalid")


if __name__ == "__main__":
    unittest.main()
