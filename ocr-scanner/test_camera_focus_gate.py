import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from camera import CameraController


class CameraFocusGateTest(unittest.TestCase):
    def test_focus_states(self):
        self.assertTrue(CameraController._focus_state({"AfState": "Focused"}))
        self.assertTrue(CameraController._focus_state({"AfState": 2}))
        self.assertFalse(CameraController._focus_state({"AfState": "Failed"}))
        self.assertIsNone(CameraController._focus_state({"AfState": "Scanning"}))
        self.assertIsNone(CameraController._focus_state({"AfState": "Idle"}))
        self.assertIsNone(CameraController._focus_state({}))

    def test_nested_focus_state(self):
        metadata = {"frames": [{"controls": {"AfState": "Focused"}}]}
        self.assertTrue(CameraController._focus_state(metadata))

    def test_command_requires_capture_time_autofocus(self):
        controller = CameraController()
        command = controller._capture_command(
            Path("/tmp/image.jpg"),
            Path("/tmp/metadata.json"),
        )

        self.assertIn("--autofocus-on-capture", command)

        mode_index = command.index("--autofocus-mode")
        self.assertEqual(command[mode_index + 1], "auto")

        timeout_index = command.index("--timeout")
        self.assertGreaterEqual(int(command[timeout_index + 1]), 5000)
        self.assertNotEqual(command[timeout_index + 1], "2000")

    def _validate(self, metadata_text, sharpness):
        controller = CameraController()
        controller.capture_width = 1
        controller.capture_height = 1
        controller.minimum_jpeg_bytes = 1
        controller.minimum_sharpness = 70.0

        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "capture.jpg"
            metadata = Path(directory) / "capture.json"

            image.write_bytes(b"mock-jpeg")
            metadata.write_text(metadata_text, encoding="utf-8")

            with (
                patch.object(
                    controller,
                    "_jpeg_dimensions",
                    return_value=(1, 1),
                ),
                patch.object(
                    controller,
                    "_sharpness",
                    return_value=sharpness,
                ),
            ):
                return controller._validate_capture(
                    str(image),
                    str(metadata),
                )

    def test_missing_metadata_blocks_submission(self):
        accepted, _ = self._validate("{}", 120.0)
        self.assertFalse(accepted)

    def test_scanning_state_blocks_submission(self):
        accepted, _ = self._validate('{"AfState":"Scanning"}', 120.0)
        self.assertFalse(accepted)

    def test_blur_blocks_submission(self):
        accepted, _ = self._validate('{"AfState":"Focused"}', 20.0)
        self.assertFalse(accepted)

    def test_focused_sharp_capture_is_accepted(self):
        accepted, _ = self._validate('{"AfState":"Focused"}', 120.0)
        self.assertTrue(accepted)


if __name__ == "__main__":
    unittest.main()
