import unittest

from gui.single_line_label import ellipsize_text


class SingleLineLabelTests(unittest.TestCase):
    @staticmethod
    def measure(text):
        return len(text) * 10

    def test_text_that_fits_is_unchanged(self):
        self.assertEqual(ellipsize_text("Online", 60, self.measure), "Online")

    def test_overflow_uses_pixel_measured_ellipsis(self):
        rendered = ellipsize_text("Processing Birth Certificate", 100, self.measure)
        self.assertEqual(rendered, "Processin…")
        self.assertLessEqual(self.measure(rendered), 100)

    def test_whitespace_and_newlines_never_create_wrapped_content(self):
        rendered = ellipsize_text("Waiting\nfor   request", 300, self.measure)
        self.assertEqual(rendered, "Waiting for request")


if __name__ == "__main__":
    unittest.main()
