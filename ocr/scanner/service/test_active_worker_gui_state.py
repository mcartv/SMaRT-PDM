import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import active_worker_gui_state as monitor


class DeviceStateMonitorTests(unittest.TestCase):
    def test_monitor_checks_local_state_with_subsecond_latency(self):
        self.assertLessEqual(monitor.MONITOR_INTERVAL_SECONDS, 0.5)
        self.assertGreaterEqual(monitor.DEVICE_HEARTBEAT_SECONDS, 2.0)
        self.assertLessEqual(monitor.DEVICE_HEARTBEAT_SECONDS, 3.0)

    def test_probe_configuration_requires_two_distinct_https_urls(self):
        base = {
            "PUBLIC_INTERNET_PROBE_URL_1": "https://one.example/health",
            "PUBLIC_INTERNET_PROBE_URL_2": "https://two.example/health",
            "RENDER_API_BASE_URL": "https://smart-pdm.example",
        }
        config = monitor.load_probe_config(base)
        self.assertEqual(config.backend_health_url, "https://smart-pdm.example/api/health")
        with self.assertRaises(ValueError):
            monitor.load_probe_config({**base, "PUBLIC_INTERNET_PROBE_URL_1": "http://one.example"})
        with self.assertRaises(ValueError):
            monitor.load_probe_config({**base, "PUBLIC_INTERNET_PROBE_URL_2": base["PUBLIC_INTERNET_PROBE_URL_1"]})
        with self.assertRaises(ValueError):
            monitor.load_probe_config(
                {
                    **base,
                    "PUBLIC_INTERNET_PROBE_URL_1": "https://smart-pdm.example/public-health",
                }
            )

    def test_probes_are_independent(self):
        config = monitor.ProbeConfig(
            public_urls=("https://one.example", "https://two.example"),
            backend_health_url="https://backend.example/api/health",
            interval_seconds=5,
            timeout_seconds=2,
        )
        outcomes = {
            "https://one.example": False,
            "https://two.example": True,
            "https://backend.example/api/health": False,
        }
        internet, backend = monitor.run_connectivity_probes(
            config, requester=lambda url, _timeout: outcomes[url]
        )
        self.assertEqual(internet, "online")
        self.assertEqual(backend, "unavailable")

        outcomes["https://two.example"] = False
        outcomes["https://backend.example/api/health"] = True
        internet, backend = monitor.run_connectivity_probes(
            config, requester=lambda url, _timeout: outcomes[url]
        )
        self.assertEqual(internet, "offline")
        self.assertEqual(backend, "no_internet")

    def test_worker_heartbeat_freshness_uses_local_file_age(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "worker_activity.json"
            path.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "worker_state": "running_ocr",
                        "camera_status": "captured",
                        "updated_at": "2026-08-28T00:00:00Z",
                    }
                ),
                encoding="utf-8",
            )
            payload, fresh = monitor.read_worker_activity(path, now=path.stat().st_mtime + 1)
            self.assertTrue(fresh)
            self.assertEqual(payload["worker_state"], "running_ocr")
            _payload, fresh = monitor.read_worker_activity(
                path,
                now=path.stat().st_mtime + monitor.WORKER_HEARTBEAT_STALE_SECONDS + 1,
            )
            self.assertFalse(fresh)


if __name__ == "__main__":
    unittest.main()
