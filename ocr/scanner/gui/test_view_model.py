import unittest

from gui.state_reader import ReadResult
from gui.view_model import build_view_model


def snapshot(**updates):
    payload = {
        "schema_version": 1,
        "device_id": "smartpdm-ocr-01",
        "internet_status": "online",
        "backend_status": "connected",
        "worker_status": "ready",
        "activity": "idle",
        "worker_state": "idle",
        "camera_status": "ready",
        "document_label": "No active document",
        "reported_at": "2026-08-28T12:00:00Z",
        "activity_state": {"text": "Waiting for request"},
    }
    payload.update(updates)
    return payload


class ViewModelTests(unittest.TestCase):
    def test_top_badge_represents_only_internet(self):
        model = build_view_model(
            ReadResult(
                "available",
                snapshot(
                    internet_status="online",
                    backend_status="unavailable",
                    worker_status="offline",
                ),
            )
        )
        self.assertEqual(model.internet_badge, "ONLINE")
        self.assertEqual(model.backend_status, "Unavailable")
        self.assertEqual(model.worker_status, "Offline")

    def test_no_internet_does_not_mark_fresh_worker_offline(self):
        model = build_view_model(
            ReadResult(
                "available",
                snapshot(
                    internet_status="offline",
                    backend_status="no_internet",
                    worker_status="ready",
                ),
            )
        )
        self.assertEqual(model.internet_badge, "OFFLINE")
        self.assertEqual(model.backend_status, "No Internet")
        self.assertEqual(model.worker_status, "Ready")

    def test_known_activity_uses_short_locked_wording(self):
        model = build_view_model(
            ReadResult(
                "available",
                snapshot(
                    activity="processing",
                    activity_state={"text": "Processing Birth Certificate"},
                ),
            )
        )
        self.assertEqual(model.activity_text, "Processing Birth Certificate")
        self.assertEqual(model.progress_percent, 72)


if __name__ == "__main__":
    unittest.main()
