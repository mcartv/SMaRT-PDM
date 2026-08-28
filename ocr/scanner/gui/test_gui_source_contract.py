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


if __name__ == "__main__":
    unittest.main()
