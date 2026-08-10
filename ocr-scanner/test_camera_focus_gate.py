import unittest
from pathlib import Path

from camera import CameraController


class CameraFixedLensGateTest(unittest.TestCase):
    def test_capture_command_is_manual_lens_225_with_sensor_crop(self):
        controller = CameraController()
        command = controller._manual_command(
            Path("/tmp/image.jpg"),
            controller.fixed_lens_position,
            width=controller.capture_width,
            height=controller.capture_height,
            timeout_ms=controller.capture_timeout_ms,
        )

        self.assertNotIn("--autofocus-on-capture", command)
        self.assertNotIn("--autofocus-range", command)
        mode_index = command.index("--autofocus-mode")
        self.assertEqual(command[mode_index + 1], "manual")
        lens_index = command.index("--lens-position")
        self.assertEqual(command[lens_index + 1], "2.2500")
        roi_index = command.index("--roi")
        self.assertEqual(
            command[roi_index + 1],
            "0.0800,0.0800,0.8400,0.8400",
        )

    def test_invalid_roi_uses_safe_center_crop(self):
        self.assertEqual(
            CameraController._parse_roi("0.9,0.9,0.5,0.5"),
            (0.08, 0.08, 0.84, 0.84),
        )


if __name__ == "__main__":
    unittest.main()
