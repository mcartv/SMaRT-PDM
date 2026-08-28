import unittest

from runtime.device_state import (
    activity_status_from_worker_state,
    backend_status_from_probe,
    build_device_state,
    internet_status_from_probes,
    worker_status_from_state,
)


class DeviceStateTests(unittest.TestCase):
    def test_either_public_probe_is_enough_for_online(self):
        self.assertEqual(internet_status_from_probes(True, False), "online")
        self.assertEqual(internet_status_from_probes(False, True), "online")
        self.assertEqual(internet_status_from_probes(True, True), "online")
        self.assertEqual(internet_status_from_probes(False, False), "offline")

    def test_backend_state_is_independent_with_no_internet_precedence(self):
        self.assertEqual(backend_status_from_probe("offline", True), "no_internet")
        self.assertEqual(backend_status_from_probe("online", True), "connected")
        self.assertEqual(backend_status_from_probe("online", False), "unavailable")

    def test_worker_heartbeat_does_not_change_network_states(self):
        state = build_device_state(
            device_id="smartpdm-ocr-01",
            internet_status="offline",
            backend_status="no_internet",
            worker_snapshot={
                "worker_state": "idle",
                "camera_status": "ready",
                "updated_at": "2026-08-28T00:00:00Z",
            },
            heartbeat_fresh=True,
            internet_checked_at="2026-08-28T00:00:01Z",
            backend_checked_at="2026-08-28T00:00:01Z",
            state_changed_at="2026-08-28T00:00:01Z",
        )
        self.assertEqual(state.internet_status, "offline")
        self.assertEqual(state.backend_status, "no_internet")
        self.assertEqual(state.worker_status, "ready")

    def test_worker_and_activity_mappings_cover_locked_states(self):
        self.assertEqual(worker_status_from_state("running_ocr", heartbeat_fresh=True), "busy")
        self.assertEqual(worker_status_from_state("failed", heartbeat_fresh=True), "error")
        self.assertEqual(worker_status_from_state("idle", heartbeat_fresh=False), "offline")
        self.assertEqual(activity_status_from_worker_state("request_claimed"), "request_received")
        self.assertEqual(activity_status_from_worker_state("waiting_for_capture"), "ready_to_capture")
        self.assertEqual(activity_status_from_worker_state("running_ocr"), "processing")
        self.assertEqual(activity_status_from_worker_state("submitting_result"), "submitting")


if __name__ == "__main__":
    unittest.main()
