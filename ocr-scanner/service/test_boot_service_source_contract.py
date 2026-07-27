from pathlib import Path
import unittest


SERVICE_ROOT = Path(__file__).resolve().parent


class BootServiceSourceContractTest(unittest.TestCase):
    def read(self, filename: str) -> str:
        return (SERVICE_ROOT / filename).read_text(encoding="utf-8")

    def test_services_are_independent_and_supervised(self):
        worker = self.read("smart-pdm-worker.service")
        gui = self.read("smart-pdm-gui.service")

        for content in (worker, gui):
            self.assertIn("Restart=on-failure", content)
            self.assertIn("WantedBy=default.target", content)
            self.assertIn("After=graphical-session.target", content)
            self.assertNotIn("network-online.target", content)
            self.assertNotIn("Requires=network", content)
            self.assertNotIn("Wants=network", content)

        self.assertNotIn("smart-pdm-gui.service", worker)
        self.assertNotIn("smart-pdm-worker.service", gui)

    def test_service_launchers_do_not_manage_other_processes(self):
        worker = self.read("start_worker_service.sh")
        gui = self.read("start_gui_service.sh")

        for content in (worker, gui):
            self.assertNotIn("pgrep", content)
            self.assertNotIn("pkill", content)
            self.assertNotIn("kill ", content)
            self.assertIn("network_startup_dependency=false", content)

        self.assertIn("/usr/bin/python3 -u job_worker.py", worker)
        self.assertIn("/usr/bin/python3 -m gui.app", gui)

    def test_worker_requires_configuration_but_not_connectivity(self):
        worker = self.read("start_worker_service.sh")

        self.assertIn("RENDER_API_BASE_URL", worker)
        self.assertNotIn("ping ", worker)
        self.assertNotIn("curl ", worker)
        self.assertNotIn("wget ", worker)
        self.assertNotIn("nm-online", worker)

    def test_gui_starts_without_worker_or_network_dependency(self):
        gui_service = self.read("smart-pdm-gui.service")
        gui_launcher = self.read("start_gui_service.sh")

        self.assertNotIn("Requires=smart-pdm-worker", gui_service)
        self.assertNotIn("After=smart-pdm-worker", gui_service)
        self.assertNotIn("ping ", gui_launcher)
        self.assertNotIn("curl ", gui_launcher)
        self.assertIn("SMART_PDM_OCR_STATE_PATH", gui_launcher)

    def test_installation_uses_user_services(self):
        installer = self.read("install_user_services.sh")

        self.assertIn("$HOME/.config/systemd/user", installer)
        self.assertIn("systemctl --user enable", installer)
        self.assertNotIn("sudo systemctl", installer)
        self.assertIn("linger_required=false", installer)


if __name__ == "__main__":
    unittest.main()
