import unittest
from pathlib import Path


SERVICE_DIRECTORY = Path(__file__).resolve().parent


class PiStatusServiceContractTests(unittest.TestCase):
    def test_gui_service_starts_read_only_app_and_monitor(self):
        unit = (SERVICE_DIRECTORY / "smart-pdm-gui.service").read_text(encoding="utf-8")
        launcher = (SERVICE_DIRECTORY / "start_gui_service.sh").read_text(encoding="utf-8")
        session_launcher = (SERVICE_DIRECTORY / "gui_session_launcher.py").read_text(encoding="utf-8")
        self.assertIn("smart-pdm-gui-state.service", unit)
        self.assertIn("Restart=on-failure", unit)
        self.assertIn("gui_session_launcher.py", launcher)
        self.assertIn("python3\", \"-m\", \"gui.app", session_launcher)
        self.assertIn("network_startup_dependency=false", session_launcher)

    def test_state_service_uses_canonical_scanner_tree_and_device_state(self):
        unit = (SERVICE_DIRECTORY / "smart-pdm-gui-state.service").read_text(encoding="utf-8")
        self.assertIn("/ocr/scanner", unit)
        self.assertIn("SMART_PDM_DEVICE_STATE_PATH", unit)
        self.assertIn("active_worker_gui_state.py", unit)

    def test_pi_update_is_fast_forward_only_and_validates_configuration(self):
        updater = (SERVICE_DIRECTORY / "update_pi_status_ui.sh").read_text(encoding="utf-8")
        self.assertIn("fetch origin main:refs/remotes/origin/main", updater)
        self.assertIn("merge --ff-only origin/main", updater)
        self.assertIn("load_probe_config", updater)
        self.assertIn("tracked_worktree_changes", updater)
        self.assertIn("systemctl --user restart", updater)
        self.assertIn("sudo systemctl restart ocr-start.service", updater)

    def test_backend_probe_timeout_avoids_half_second_status_flicker(self):
        monitor = (SERVICE_DIRECTORY / "active_worker_gui_state.py").read_text(encoding="utf-8")
        self.assertIn('max(2.0, float(values.get("PUBLIC_INTERNET_PROBE_TIMEOUT_SECONDS", "3")))', monitor)
        self.assertIn("min(\n        6.0,", monitor)


if __name__ == "__main__":
    unittest.main()
