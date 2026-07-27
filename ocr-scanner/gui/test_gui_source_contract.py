import unittest
from pathlib import Path


class GuiSourceContractTest(unittest.TestCase):
    def test_gui_is_read_only_and_does_not_import_worker_controls(self):
        gui_root = Path(__file__).resolve().parent
        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in gui_root.glob("*.py")
            if not path.name.startswith("test_")
        )

        prohibited = (
            "ApiClient",
            "run_capture_session",
            "ButtonReader",
            "submit_result",
            "rpicam-hello",
            "rpicam-still",
            "extract_text(",
        )
        for token in prohibited:
            with self.subTest(token=token):
                self.assertNotIn(token, source)

    def test_gui_source_does_not_reference_private_document_fields(self):
        gui_root = Path(__file__).resolve().parent
        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in gui_root.glob("*.py")
            if not path.name.startswith("test_")
        )

        prohibited = (
            "general_weighted_average",
            "child_name",
            "mother_name",
            "father_name",
            "corrected_text",
            "raw_text",
            "student_name",
        )
        for token in prohibited:
            with self.subTest(token=token):
                self.assertNotIn(token, source)


if __name__ == "__main__":
    unittest.main()
