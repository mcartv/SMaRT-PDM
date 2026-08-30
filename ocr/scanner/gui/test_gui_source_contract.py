import inspect
import unittest

from gui import main_window
from gui.single_line_label import SingleLineLabel


class GuiSourceContractTests(unittest.TestCase):
    def test_every_normal_screen_label_uses_single_line_component(self):
        source = inspect.getsource(main_window)
        self.assertNotIn("tk.Label(", source)
        self.assertNotIn("wraplength", source)
        self.assertIn("SingleLineLabel", source)

    def test_single_line_component_has_no_dynamic_font_shrinking(self):
        source = inspect.getsource(SingleLineLabel)
        self.assertNotIn("font.configure", source)
        self.assertIn('kwargs.pop("wraplength", None)', source)
        self.assertIn("ellipsize_text", source)

    def test_gui_refresh_latency_is_subsecond(self):
        self.assertLessEqual(main_window.POLL_INTERVAL_MS, 500)

    def test_kiosk_window_is_enforced_after_initial_mapping(self):
        source = inspect.getsource(main_window.ScannerStatusWindow._configure_root)
        kiosk_source = inspect.getsource(main_window.ScannerStatusWindow._enforce_kiosk_window)
        self.assertIn("after_idle", source)
        self.assertIn("overrideredirect(True)", kiosk_source)
        self.assertIn("winfo_screenwidth", kiosk_source)
        self.assertIn("winfo_screenheight", kiosk_source)

    def test_status_window_yields_to_live_camera_preview(self):
        source = inspect.getsource(
            main_window.ScannerStatusWindow._set_camera_preview_mode
        )
        self.assertIn("withdraw()", source)
        self.assertIn("deiconify()", source)
        self.assertIn("after_idle(self._enforce_kiosk_window)", source)

    def test_preview_mode_hides_and_restores_the_kiosk_once(self):
        events = []

        class FakeRoot:
            def withdraw(self):
                events.append("withdraw")

            def deiconify(self):
                events.append("deiconify")

            def after_idle(self, callback):
                events.append(("after_idle", callback.__name__))

        window = main_window.ScannerStatusWindow.__new__(
            main_window.ScannerStatusWindow
        )
        window.root = FakeRoot()
        window._yielding_to_camera_preview = False

        window._set_camera_preview_mode(True)
        window._set_camera_preview_mode(True)
        window._set_camera_preview_mode(False)

        self.assertEqual(
            events,
            [
                "withdraw",
                "deiconify",
                ("after_idle", "_enforce_kiosk_window"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
