import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import active_worker_gui_state as bridge


class ActiveWorkerGuiStateTests(unittest.TestCase):
    def test_fresh_worker_activity_replaces_false_idle_state(self):
        contract = bridge.load_contract()
        with tempfile.TemporaryDirectory() as directory:
            activity_path = Path(directory) / "worker_activity.json"
            activity = contract.build_worker_state(
                sequence=1,
                worker_state="running_ocr",
                request_reference="e8126252-c44d-4185-8244-72ea15d79758",
                document_key="student_grade_forms",
                camera_status="captured",
            ).to_dict()
            activity_path.write_text(json.dumps(activity), encoding="utf-8")
            with patch.object(bridge, "ACTIVITY_PATH", activity_path):
                payload = bridge.build_contract_payload(contract, sequence=9, active=True)

        self.assertEqual(payload["worker_state"], "running_ocr")
        self.assertEqual(payload["camera_status"], "captured")
        self.assertEqual(payload["sequence"], 9)


if __name__ == "__main__":
    unittest.main()
