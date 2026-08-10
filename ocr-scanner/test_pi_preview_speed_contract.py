import unittest
from pathlib import Path

import camera
import capture_session


class OrderedCamera:
    def __init__(self, events):
        self.events = events
        self.capture_file = "/tmp/raw_capture.jpg"

    def check_available(self):
        self.events.append("camera_check")
        return True

    def start_preview(self):
        self.events.append("preview_start")
        return True

    def capture_image(self, *, restart_preview=True):
        self.events.append("capture")
        return True

    def stop_preview(self):
        self.events.append("preview_stop")

    def cleanup(self):
        self.events.append("cleanup")


class OrderedButtons:
    def __init__(self, events):
        self.events = events

    def start(self):
        self.events.append("buttons_start")

    def wait_for_press(self, *, should_stop=None):
        self.events.append("button_wait")
        return "left"

    def close(self):
        self.events.append("buttons_close")


class PreviewAndSpeedContractTest(unittest.TestCase):
    def test_request_opens_preview_before_waiting_for_button(self):
        events = []
        result = capture_session.run_capture_session(
            camera=OrderedCamera(events),
            buttons=OrderedButtons(events),
            path_exists=lambda _path: True,
        )

        self.assertEqual(
            result.status,
            capture_session.CAPTURED,
        )
        self.assertLess(
            events.index("preview_start"),
            events.index("button_wait"),
        )
        self.assertEqual(events.count("capture"), 1)

    def test_camera_fast_defaults_remain_bounded(self):
        controller = camera.CameraController()

        self.assertEqual(controller.fixed_lens_position, 2.25)
        self.assertEqual(controller.capture_timeout_ms, 650)
        self.assertEqual(controller.capture_roi, (0.08, 0.08, 0.84, 0.84))

    def test_preprocessing_does_not_require_debug_disk_write(self):
        source = Path("ocr.py").read_text(
            encoding="utf-8",
        )

        self.assertIn(
            "OCR_SAVE_PROCESSED_DEBUG",
            source,
        )
        self.assertIn(
            "cv2.IMREAD_GRAYSCALE",
            source,
        )
        self.assertNotIn(
            "cv2.imwrite(PROC_FILE, processed)",
            source,
        )

    def test_local_contract_test_imports_only_stdlib_and_local_modules(self):
        tree = __import__("ast").parse(
            Path(__file__).read_text(
                encoding="utf-8",
            )
        )
        allowed = {
            "ast",
            "pathlib",
            "unittest",
            "camera",
            "capture_session",
        }

        for node in __import__("ast").walk(tree):
            if isinstance(node, __import__("ast").Import):
                names = [
                    alias.name.split(".", 1)[0]
                    for alias in node.names
                ]
            elif isinstance(node, __import__("ast").ImportFrom):
                names = [
                    (node.module or "").split(".", 1)[0]
                ]
            else:
                continue

            for name in names:
                self.assertIn(name, allowed)

    def test_api_loads_colocated_environment(self):
        source = Path("api.py").read_text(
            encoding="utf-8",
        )

        self.assertIn(
            'Path(__file__).resolve().with_name(".env")',
            source,
        )
        self.assertIn(
            "_load_colocated_env",
            source,
        )
        self.assertIn(
            "SMaRT-PDM-Pi-IoT-OCR/3",
            source,
        )

    def test_worker_starts_capture_session_directly_after_claim(self):
        source = Path("job_worker.py").read_text(
            encoding="utf-8",
        )

        claimed_index = source.index(
            'log.info("Claimed request=%s"'
        )
        preview_index = source.index(
            "run_scan(request)",
            claimed_index,
        )

        self.assertGreater(preview_index, claimed_index)
        self.assertIn(
            "opening camera preview",
            source.lower(),
        )

    def test_preview_starts_local_left_button_instruction_overlay(self):
        source = Path("camera.py").read_text(encoding="utf-8")
        overlay = Path("preview_instruction_overlay.py").read_text(
            encoding="utf-8"
        )

        self.assertIn("_start_preview_instruction_overlay()", source)
        self.assertIn("PRESS THE LEFT BUTTON", overlay)
        self.assertIn('root.geometry("+24+24")', overlay)

    def test_lifecycle_heartbeat_uses_an_independent_http_client(self):
        source = Path("job_worker.py").read_text(encoding="utf-8")
        heartbeat = source[source.index("def send_heartbeat") :]

        self.assertIn("heartbeat_api = ApiClient()", heartbeat)
        self.assertIn("heartbeat_api.update_status", heartbeat)

    def test_fixed_lens_capture_uses_one_cropped_full_resolution_sample(self):
        controller = camera.CameraController()
        source = Path("camera.py").read_text(encoding="utf-8")
        capture = source[
            source.index("def capture_image") :
            source.index("def cleanup")
        ]

        self.assertEqual(controller.fixed_lens_position, 2.25)
        self.assertNotIn("_coarse_sweep", capture)
        self.assertNotIn("_refine_position", capture)
        self.assertNotIn("_try_native_autofocus", capture)
        self.assertEqual(capture.count("self._sample_position("), 1)

        camera_source = Path("camera.py").read_text(encoding="utf-8")
        self.assertNotIn("COARSE SWEEP", camera_source)
        self.assertNotIn("FINE SWEEP", camera_source)
        self.assertNotIn("def _coarse_sweep", camera_source)
        self.assertNotIn("def _refine_position", camera_source)

        command = controller._manual_command(
            Path("/tmp/capture.jpg"),
            controller.fixed_lens_position,
            width=controller.capture_width,
            height=controller.capture_height,
            timeout_ms=controller.capture_timeout_ms,
        )
        self.assertIn("--roi", command)
        self.assertIn("0.0800,0.0800,0.8400,0.8400", command)
        mode_index = command.index("--autofocus-mode")
        self.assertEqual(command[mode_index + 1], "manual")
        lens_index = command.index("--lens-position")
        self.assertEqual(command[lens_index + 1], "2.2500")

    def test_left_press_gets_immediate_local_processing_feedback(self):
        source = Path("capture_session.py").read_text(encoding="utf-8")
        left_index = source.index('pressed != "left"')
        feedback_index = source.index("show_processing_status()", left_index)
        capture_status_index = source.index('on_status("capturing")', left_index)

        self.assertLess(feedback_index, capture_status_index)


if __name__ == "__main__":
    unittest.main()
