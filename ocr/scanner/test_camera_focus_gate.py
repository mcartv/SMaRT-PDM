import unittest
from pathlib import Path

from camera import CameraController


class CameraFixedLensGateTest(unittest.TestCase):
    def test_capture_command_is_manual_lens_150_with_sensor_crop(self):
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
        self.assertEqual(command[lens_index + 1], "1.5000")
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

    def test_birth_profile_uses_continuous_autofocus_capture_controls(self):
        controller = CameraController()
        controller.capture_profile = "psa_birth_v1"
        controller.focus_mode = "continuous"
        command = controller._continuous_autofocus_command(
            Path("/tmp/birth.jpg"),
            width=4608,
            height=2592,
            timeout_ms=controller.autofocus_capture_timeout_ms,
        )

        expected = {
            "--shutter": "20000",
            "--gain": "1.00",
            "--awb": "off",
            "--brightness": "0.10",
            "--contrast": "1.20",
            "--autofocus-mode": "continuous",
        }
        for option, value in expected.items():
            self.assertEqual(command[command.index(option) + 1], value)
        self.assertNotIn("--lens-position", command)

    def test_grade_profile_uses_continuous_autofocus_without_birth_tuning(self):
        controller = CameraController()
        controller.focus_mode = "continuous"
        command = controller._continuous_autofocus_command(
            Path("/tmp/grade.jpg"),
            width=controller.capture_width,
            height=controller.capture_height,
            timeout_ms=controller.autofocus_capture_timeout_ms,
        )

        self.assertEqual(
            command[command.index("--autofocus-mode") + 1],
            "continuous",
        )
        self.assertNotIn("--lens-position", command)
        self.assertEqual(command[command.index("--awb") + 1], "auto")
        self.assertNotIn("--shutter", command)

    def test_default_profile_retains_automatic_white_balance(self):
        controller = CameraController()
        command = controller._manual_command(
            Path("/tmp/default.jpg"),
            controller.fixed_lens_position,
            width=controller.capture_width,
            height=controller.capture_height,
            timeout_ms=controller.capture_timeout_ms,
        )

        self.assertEqual(command[command.index("--awb") + 1], "auto")
        self.assertNotIn("--shutter", command)
        self.assertNotIn("--gain", command)

    def test_birth_preview_uses_known_compatible_arguments(self):
        controller = CameraController()
        controller.capture_profile = "psa_birth_v1"
        controller.focus_mode = "continuous"

        command = controller._preview_command()

        self.assertEqual(command[command.index("--autofocus-mode") + 1], "continuous")
        self.assertNotIn("--lens-position", command)
        self.assertNotIn("--shutter", command)
        self.assertNotIn("--gain", command)
        self.assertNotIn("--awb", command)
        self.assertNotIn("--brightness", command)
        self.assertNotIn("--contrast", command)

    def test_birth_compatibility_still_retains_autofocus_and_resolution(self):
        controller = CameraController()
        controller.capture_profile = "psa_birth_v1"
        controller.focus_mode = "continuous"

        command = controller._continuous_autofocus_command(
            Path("/tmp/birth-compatible.jpg"),
            width=4608,
            height=2592,
            timeout_ms=controller.autofocus_capture_timeout_ms,
            use_profile_tuning=False,
        )

        self.assertEqual(command[command.index("--width") + 1], "4608")
        self.assertEqual(command[command.index("--height") + 1], "2592")
        self.assertEqual(command[command.index("--autofocus-mode") + 1], "continuous")
        self.assertNotIn("--lens-position", command)
        self.assertEqual(command[command.index("--awb") + 1], "auto")
        self.assertNotIn("--shutter", command)
        self.assertNotIn("--gain", command)


if __name__ == "__main__":
    unittest.main()
