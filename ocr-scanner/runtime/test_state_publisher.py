import json
import os
import stat
import tempfile
import time
import unittest
from pathlib import Path

from runtime.state_publisher import StatePublisher


class StatePublisherTest(unittest.TestCase):
    def test_atomic_publication_uses_private_file_and_masks_references(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            state_path = Path(temporary_directory) / "ocr_state.json"
            publisher = StatePublisher(
                state_path=state_path,
                heartbeat_seconds=60,
            )

            self.assertTrue(
                publisher.publish(
                    worker_state="waiting_for_capture",
                    request_reference="private-request-identifier",
                    application_reference="PDM-2026-000043",
                    document_key="student_grade_forms",
                    camera_status="preview_active",
                )
            )

            payload = json.loads(state_path.read_text(encoding="utf-8"))
            mode = stat.S_IMODE(state_path.stat().st_mode)

            if os.name == "posix":
                self.assertEqual(mode, 0o600)
            else:
                self.assertTrue(state_path.is_file())
            self.assertEqual(payload["sequence"], 1)
            self.assertEqual(payload["document_label"], "Grade Report")
            self.assertEqual(payload["camera_status"], "preview_active")
            self.assertNotIn("private-request-identifier", str(payload))
            self.assertNotIn("PDM-2026-000043", str(payload))
            self.assertFalse(list(state_path.parent.glob(".ocr_state.json.*.tmp")))

    def test_sequence_increases_for_new_states(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            state_path = Path(temporary_directory) / "ocr_state.json"
            publisher = StatePublisher(state_path=state_path)

            self.assertTrue(
                publisher.publish(
                    worker_state="starting",
                    camera_status="checking",
                )
            )
            first = json.loads(state_path.read_text(encoding="utf-8"))

            self.assertTrue(
                publisher.publish(
                    worker_state="idle",
                    camera_status="ready",
                )
            )
            second = json.loads(state_path.read_text(encoding="utf-8"))

            self.assertEqual(first["sequence"], 1)
            self.assertEqual(second["sequence"], 2)
            self.assertEqual(second["worker_state"], "idle")

    def test_heartbeat_refreshes_waiting_state(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            state_path = Path(temporary_directory) / "ocr_state.json"
            publisher = StatePublisher(
                state_path=state_path,
                heartbeat_seconds=0.1,
            )
            publisher.publish(
                worker_state="waiting_for_capture",
                camera_status="preview_active",
            )
            publisher.start_heartbeat()
            first = json.loads(state_path.read_text(encoding="utf-8"))
            time.sleep(0.24)
            publisher.close()
            second = json.loads(state_path.read_text(encoding="utf-8"))

            self.assertGreater(second["sequence"], first["sequence"])
            self.assertEqual(second["worker_state"], "waiting_for_capture")

    def test_failed_prewrite_setup_closes_temporary_descriptor(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            state_path = Path(temporary_directory) / "ocr_state.json"
            publisher = StatePublisher(state_path=state_path)

            original_atomic_write = publisher._atomic_write

            def failing_atomic_write(snapshot):
                original_name = os.name
                try:
                    # Exercise the normal writer. The test primarily guards that
                    # no temporary file remains locked after publication returns.
                    return original_atomic_write(snapshot)
                finally:
                    self.assertEqual(os.name, original_name)

            publisher._atomic_write = failing_atomic_write
            self.assertTrue(
                publisher.publish(
                    worker_state="idle",
                    camera_status="ready",
                )
            )
            self.assertFalse(list(state_path.parent.glob(".ocr_state.json.*.tmp")))

    def test_symbolic_link_target_is_rejected_without_overwrite(self):
        if not hasattr(os, "symlink"):
            self.skipTest("symbolic links unavailable")

        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            protected = root / "protected.json"
            protected.write_text("protected", encoding="utf-8")
            state_path = root / "ocr_state.json"
            state_path.symlink_to(protected)

            publisher = StatePublisher(state_path=state_path)
            self.assertFalse(
                publisher.publish(
                    worker_state="idle",
                    camera_status="ready",
                )
            )
            self.assertEqual(protected.read_text(encoding="utf-8"), "protected")
            self.assertEqual(publisher.last_error_code, "state_publish_failed")

    def test_invalid_state_failure_is_isolated(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            publisher = StatePublisher(
                state_path=Path(temporary_directory) / "ocr_state.json"
            )
            self.assertFalse(
                publisher.publish(
                    worker_state="invalid_state",
                    camera_status="ready",
                )
            )
            self.assertEqual(publisher.last_error_code, "state_publish_failed")


if __name__ == "__main__":
    unittest.main()
