import io
import struct
import unittest
from unittest.mock import patch

import button_input
from button_input import ButtonReader, LEFT_CODE, RIGHT_CODE


def event(code):
    return struct.pack("llHHI", 0, 0, 1, code, 0)


class ButtonInputResilienceTest(unittest.TestCase):
    @patch.object(
        button_input,
        "resolve_input_device",
        side_effect=AssertionError(
            "injected readers must not scan host input devices"
        ),
    )
    @patch.object(button_input, "fcntl", None)
    def test_injected_reader_bypasses_device_discovery(
        self,
        _resolve_input_device,
    ):
        stream = io.BytesIO(
            event(LEFT_CODE) + event(RIGHT_CODE)
        )
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

    @patch.object(button_input, "fcntl", None)
    def test_explicit_path_does_not_require_ioctl(self):
        stream = io.BytesIO(event(LEFT_CODE))
        opened = []

        def opener(path, mode):
            opened.append((path, mode))
            return stream

        reader = ButtonReader(
            "/dev/input/test-event",
            file_opener=opener,
            clock=lambda: 1.0,
            sleeper=lambda _seconds: None,
            debounce_ms=0,
        )

        reader.start()
        self.assertEqual(
            opened,
            [("/dev/input/test-event", "rb")],
        )
        self.assertEqual(reader.poll_press(), "left")
        reader.close()

    @patch.object(button_input.os.path, "exists")
    @patch.object(button_input.os, "access")
    @patch.object(button_input, "_supports_button_codes")
    def test_resolver_prefers_supported_readable_device(
        self,
        supports,
        access,
        exists,
    ):
        exists.return_value = True
        access.return_value = True
        supports.side_effect = lambda path: path.endswith(
            "event8"
        )

        with patch.object(
            button_input,
            "_candidate_input_devices",
            return_value=iter(
                (
                    "/dev/input/event4",
                    "/dev/input/event8",
                )
            ),
        ):
            self.assertEqual(
                button_input.resolve_input_device(),
                "/dev/input/event8",
            )

    @patch.object(button_input.os.path, "exists")
    @patch.object(button_input.os, "access")
    @patch.object(button_input, "_supports_button_codes")
    def test_default_event4_does_not_override_supported_scanned_device(
        self,
        supports,
        access,
        exists,
    ):
        exists.return_value = True
        access.return_value = True
        supports.side_effect = lambda path: path.endswith(
            "event8"
        )

        with patch.dict(
            button_input.os.environ,
            {},
            clear=True,
        ), patch.object(
            button_input,
            "_candidate_input_devices",
            return_value=iter(
                (
                    "/dev/input/event4",
                    "/dev/input/event8",
                )
            ),
        ):
            self.assertEqual(
                button_input.resolve_input_device(),
                "/dev/input/event8",
            )

    @patch.object(button_input.os.path, "exists")
    @patch.object(button_input.os, "access")
    @patch.object(button_input, "_supports_button_codes")
    def test_explicit_configured_device_is_trusted_when_readable(
        self,
        supports,
        access,
        exists,
    ):
        exists.return_value = True
        access.return_value = True
        supports.return_value = False

        with patch.object(
            button_input,
            "_candidate_input_devices",
            return_value=iter(
                (
                    "/dev/input/event7",
                    "/dev/input/event8",
                )
            ),
        ):
            self.assertEqual(
                button_input.resolve_input_device(
                    "/dev/input/event7"
                ),
                "/dev/input/event7",
            )
            supports.assert_not_called()

    @patch.object(button_input.os.path, "exists")
    @patch.object(button_input.os, "access")
    @patch.object(button_input, "_supports_button_codes")
    def test_first_readable_device_is_stable_fallback(
        self,
        supports,
        access,
        exists,
    ):
        exists.return_value = True
        access.return_value = True
        supports.return_value = False

        with patch.dict(
            button_input.os.environ,
            {},
            clear=True,
        ), patch.object(
            button_input,
            "_candidate_input_devices",
            return_value=iter(
                (
                    "/dev/input/event6",
                    "/dev/input/event9",
                )
            ),
        ):
            self.assertEqual(
                button_input.resolve_input_device(),
                "/dev/input/event6",
            )


    @patch.object(button_input.os, "name", "nt")
    def test_linux_device_path_is_preserved_on_windows_validation(self):
        self.assertEqual(
            button_input._canonical_device_path(
                "/dev/input/event7"
            ),
            "/dev/input/event7",
        )

    @patch.object(button_input.os.path, "exists")
    @patch.object(button_input.os, "access")
    @patch.object(button_input.os, "name", "nt")
    def test_explicit_linux_device_remains_posix_on_windows(
        self,
        access,
        exists,
    ):
        exists.return_value = True
        access.return_value = True

        with patch.object(
            button_input,
            "_candidate_input_devices",
            return_value=iter(
                (
                    "/dev/input/event7",
                    "/dev/input/event8",
                )
            ),
        ):
            self.assertEqual(
                button_input.resolve_input_device(
                    "/dev/input/event7"
                ),
                "/dev/input/event7",
            )



if __name__ == "__main__":
    unittest.main()
