import inspect
import io
import struct
import unittest
from dataclasses import FrozenInstanceError
from pathlib import Path
from unittest.mock import MagicMock, patch

import button_input
from button_input import ButtonReader, LEFT_CODE, RIGHT_CODE
from capture_session import (
    CANCELLED,
    CAPTURED,
    FAILED,
    CaptureSessionResult,
    run_capture_session,
)
from camera import CameraController


class FakeCamera:
    def __init__(self, *, available=True, preview=True, capture=True):
        self.available = available
        self.preview = preview
        self.capture = capture
        self.capture_file = "/tmp/raw_capture.jpg"
        self.available_checks = 0
        self.preview_starts = 0
        self.capture_attempts = 0
        self.capture_restart_values = []
        self.preview_stops = 0
        self.cleanup_calls = 0

    def check_available(self):
        self.available_checks += 1
        return self.available

    def start_preview(self):
        self.preview_starts += 1
        return self.preview

    def capture_image(self, *, restart_preview=True):
        self.capture_attempts += 1
        self.capture_restart_values.append(restart_preview)
        return self.capture

    def stop_preview(self):
        self.preview_stops += 1

    def cleanup(self):
        self.cleanup_calls += 1


class FakeButtons:
    def __init__(self, pressed="left", *, start_error=None, wait_error=None):
        self.pressed = pressed
        self.start_error = start_error
        self.wait_error = wait_error
        self.start_calls = 0
        self.wait_calls = 0
        self.close_calls = 0
        self.stop_callback = None

    def start(self):
        self.start_calls += 1
        if self.start_error:
            raise self.start_error

    def wait_for_press(self, *, should_stop=None):
        self.wait_calls += 1
        self.stop_callback = should_stop
        if self.wait_error:
            raise self.wait_error
        if should_stop is not None and should_stop():
            raise InterruptedError
        return self.pressed

    def close(self):
        self.close_calls += 1


class CaptureSessionTest(unittest.TestCase):
    def run_session(self, camera, buttons, *, exists=True, should_stop=None):
        return run_capture_session(
            camera=camera,
            buttons=buttons,
            path_exists=lambda _path: exists,
            should_stop=should_stop,
        )

    def assert_cleaned(self, camera, buttons):
        self.assertEqual(camera.preview_stops, 1)
        self.assertEqual(camera.cleanup_calls, 1)
        self.assertEqual(buttons.close_calls, 1)

    def test_left_opens_preview_and_captures_exactly_once(self):
        camera = FakeCamera()
        buttons = FakeButtons("left")

        result = self.run_session(camera, buttons)

        self.assertEqual(result, CaptureSessionResult(CAPTURED, "/tmp/raw_capture.jpg"))
        self.assertEqual(camera.available_checks, 1)
        self.assertEqual(camera.preview_starts, 1)
        self.assertEqual(camera.capture_attempts, 1)
        self.assertEqual(camera.capture_restart_values, [False])
        self.assertEqual(buttons.start_calls, 1)
        self.assertEqual(buttons.wait_calls, 1)
        self.assert_cleaned(camera, buttons)

    def test_right_cancels_without_capture(self):
        camera = FakeCamera()
        buttons = FakeButtons("right")

        result = self.run_session(camera, buttons)

        self.assertEqual(result, CaptureSessionResult(CANCELLED))
        self.assertEqual(camera.capture_attempts, 0)
        self.assert_cleaned(camera, buttons)

    def test_camera_unavailable_fails_and_cleans_up(self):
        camera = FakeCamera(available=False)
        buttons = FakeButtons()

        result = self.run_session(camera, buttons)

        self.assertEqual(result.error_code, "CAMERA_UNAVAILABLE")
        self.assertEqual(result.status, FAILED)
        self.assertEqual(buttons.start_calls, 0)
        self.assert_cleaned(camera, buttons)

    def test_input_start_failure_fails_and_cleans_up(self):
        camera = FakeCamera()
        buttons = FakeButtons(start_error=OSError("unavailable"))

        result = self.run_session(camera, buttons)

        self.assertEqual(result.error_code, "INPUT_DEVICE_UNAVAILABLE")
        self.assertEqual(camera.preview_starts, 0)
        self.assert_cleaned(camera, buttons)

    def test_preview_failure_skips_capture(self):
        camera = FakeCamera(preview=False)
        buttons = FakeButtons()

        result = self.run_session(camera, buttons)

        self.assertEqual(result.error_code, "PREVIEW_START_FAILED")
        self.assertEqual(camera.capture_attempts, 0)
        self.assert_cleaned(camera, buttons)

    def test_capture_failure_is_explicit(self):
        camera = FakeCamera(capture=False)
        buttons = FakeButtons("left")

        result = self.run_session(camera, buttons)

        self.assertEqual(result.error_code, "CAPTURE_FAILED")
        self.assertEqual(camera.capture_attempts, 1)
        self.assert_cleaned(camera, buttons)

    def test_missing_capture_output_is_explicit(self):
        camera = FakeCamera()
        buttons = FakeButtons("left")

        result = self.run_session(camera, buttons, exists=False)

        self.assertEqual(result.error_code, "CAPTURE_OUTPUT_UNAVAILABLE")
        self.assert_cleaned(camera, buttons)

    def test_keyboard_interrupt_returns_stable_failure_and_cleans_up(self):
        camera = FakeCamera()
        buttons = FakeButtons(wait_error=KeyboardInterrupt())

        result = self.run_session(camera, buttons)

        self.assertEqual(result.error_code, "CAPTURE_SESSION_INTERRUPTED")
        self.assertEqual(camera.capture_attempts, 0)
        self.assert_cleaned(camera, buttons)

    def test_input_read_failure_returns_stable_failure_and_cleans_up(self):
        camera = FakeCamera()
        buttons = FakeButtons(wait_error=OSError("device disconnected"))

        result = self.run_session(camera, buttons)

        self.assertEqual(result.error_code, "INPUT_DEVICE_UNAVAILABLE")
        self.assertEqual(camera.capture_attempts, 0)
        self.assert_cleaned(camera, buttons)

    def test_shutdown_callback_interrupts_wait_and_cleans_up(self):
        camera = FakeCamera()
        buttons = FakeButtons()

        result = self.run_session(camera, buttons, should_stop=lambda: True)

        self.assertEqual(result.error_code, "CAPTURE_SESSION_INTERRUPTED")
        self.assertIsNotNone(buttons.stop_callback)
        self.assert_cleaned(camera, buttons)

    def test_result_is_immutable_and_rejects_invalid_combinations(self):
        result = CaptureSessionResult(CAPTURED, "/tmp/raw_capture.jpg")
        with self.assertRaises(FrozenInstanceError):
            result.status = FAILED
        with self.assertRaises(ValueError):
            CaptureSessionResult(CAPTURED)
        with self.assertRaises(ValueError):
            CaptureSessionResult(FAILED)

    @patch("camera.subprocess.run")
    @patch("camera.os.path.getsize", return_value=1024)
    @patch("camera.os.path.exists", side_effect=[False, True])
    def test_real_camera_capture_can_skip_preview_restart(
        self, _exists, _getsize, run_command
    ):
        run_command.return_value.returncode = 0
        run_command.return_value.stderr = ""
        camera = CameraController()
        camera.is_previewing = True
        camera.stop_preview = MagicMock()
        camera.start_preview = MagicMock()

        self.assertTrue(camera.capture_image(restart_preview=False))

        camera.stop_preview.assert_called_once()
        camera.start_preview.assert_not_called()


class ButtonReaderTest(unittest.TestCase):
    @staticmethod
    def event(code):
        return struct.pack("llHHI", 0, 0, 1, code, 0)

    @patch.object(button_input, "fcntl", None)
    def test_injected_reader_returns_left_and_right_deterministically(self):
        stream = io.BytesIO(self.event(LEFT_CODE) + self.event(RIGHT_CODE))
        reader = ButtonReader(
            file_opener=lambda *_args: stream,
            clock=iter((1.0, 2.0)).__next__,
            sleeper=lambda _seconds: None,
            debounce_ms=0,
        )

        reader.start()
        self.assertEqual(reader.poll_press(), "left")
        self.assertEqual(reader.poll_press(), "right")
        reader.close()
        self.assertTrue(stream.closed)

    def test_module_does_not_change_permissions_or_execute_sudo(self):
        source = inspect.getsource(button_input)
        self.assertNotIn("chmod", source)
        self.assertNotIn("sudo", source)
        self.assertNotIn("os.system", source)

    def test_manual_entrypoint_reuses_capture_without_second_confirmation(self):
        source = Path("main.py").read_text(encoding="utf-8")
        self.assertIn("run_capture_session", source)
        self.assertNotIn("Confirm Save", source)
        self.assertNotIn("Discard", source)
        self.assertNotIn("print_text_preview", source)


if __name__ == "__main__":
    unittest.main()
