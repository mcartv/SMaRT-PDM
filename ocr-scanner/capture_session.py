"""Automatic preview-first Raspberry Pi capture session."""

import os
import time
from dataclasses import dataclass
from typing import Callable, Optional

from button_input import ButtonReader
from camera import CameraController


CAPTURED = "captured"
CANCELLED = "cancelled"
FAILED = "failed"


@dataclass(frozen=True)
class CaptureSessionResult:
    status: str
    capture_path: Optional[str] = None
    error_code: Optional[str] = None

    def __post_init__(self) -> None:
        if self.status not in {CAPTURED, CANCELLED, FAILED}:
            raise ValueError("invalid capture-session status")
        if self.status == CAPTURED and not self.capture_path:
            raise ValueError("captured result requires capture_path")
        if self.status != CAPTURED and self.capture_path is not None:
            raise ValueError("non-captured result cannot expose capture_path")
        if self.status == FAILED and not self.error_code:
            raise ValueError("failed result requires error_code")


def run_capture_session(
    *,
    camera=None,
    buttons=None,
    path_exists: Callable[[str], bool] = os.path.isfile,
    should_stop: Optional[Callable[[], bool]] = None,
    on_status: Optional[Callable[[str], None]] = None,
) -> CaptureSessionResult:
    """
    Open preview #1 immediately after a request is claimed.

    LEFT immediately locks the calibrated lens and captures once. RIGHT
    intentionally cancels. The lifecycle callback transitions directly from
    previewing to capturing; no focus sweep occurs.
    """

    resolved_camera = camera if camera is not None else CameraController()
    resolved_buttons = buttons if buttons is not None else ButtonReader()
    session_started_at = time.monotonic()

    def stop_requested() -> bool:
        return bool(should_stop and should_stop())

    try:
        try:
            if not resolved_camera.check_available():
                return CaptureSessionResult(
                    FAILED,
                    error_code="CAMERA_UNAVAILABLE",
                )
        except (InterruptedError, KeyboardInterrupt):
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )
        except Exception:
            return CaptureSessionResult(
                FAILED,
                error_code="CAMERA_UNAVAILABLE",
            )

        try:
            resolved_buttons.start()
        except (InterruptedError, KeyboardInterrupt):
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )
        except Exception:
            return CaptureSessionResult(
                FAILED,
                error_code="INPUT_DEVICE_UNAVAILABLE",
            )

        try:
            preview_started_at = time.monotonic()

            if not resolved_camera.start_preview():
                return CaptureSessionResult(
                    FAILED,
                    error_code="PREVIEW_START_FAILED",
                )

            if on_status:
                on_status("previewing")

            print(
                "Camera preview ready in "
                f"{time.monotonic() - preview_started_at:.2f}s; "
                "press LEFT to capture or RIGHT to cancel."
            )
        except (InterruptedError, KeyboardInterrupt):
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )
        except Exception:
            return CaptureSessionResult(
                FAILED,
                error_code="PREVIEW_START_FAILED",
            )

        try:
            pressed = resolved_buttons.wait_for_press(
                should_stop=should_stop,
            )
        except (InterruptedError, KeyboardInterrupt):
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )
        except Exception:
            return CaptureSessionResult(
                FAILED,
                error_code="INPUT_DEVICE_UNAVAILABLE",
            )

        if pressed == "right":
            return CaptureSessionResult(CANCELLED)

        if pressed != "left":
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )

        show_processing_status = getattr(
            resolved_camera,
            "show_processing_status",
            None,
        )
        if callable(show_processing_status):
            show_processing_status()

        if stop_requested():
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )

        if on_status:
            on_status("capturing")

        if stop_requested():
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )

        try:
            try:
                captured = resolved_camera.capture_image(
                    restart_preview=False,
                    status_callback=on_status,
                )
            except TypeError as exc:
                if "status_callback" not in str(exc):
                    raise
                captured = resolved_camera.capture_image(
                    restart_preview=False,
                )
        except (InterruptedError, KeyboardInterrupt):
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )
        except Exception:
            captured = False

        if not captured:
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_FAILED",
            )

        if stop_requested():
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_SESSION_INTERRUPTED",
            )

        capture_path = str(
            getattr(
                resolved_camera,
                "capture_file",
                "",
            )
            or ""
        )

        try:
            output_exists = bool(
                capture_path and path_exists(capture_path)
            )
        except Exception:
            output_exists = False

        if not output_exists:
            return CaptureSessionResult(
                FAILED,
                error_code="CAPTURE_OUTPUT_UNAVAILABLE",
            )

        print(
            "Capture session finalized in "
            f"{time.monotonic() - session_started_at:.2f}s."
        )
        return CaptureSessionResult(
            CAPTURED,
            capture_path=capture_path,
        )
    finally:
        try:
            resolved_camera.stop_preview()
        except Exception:
            pass

        try:
            resolved_buttons.close()
        except Exception:
            pass

        try:
            resolved_camera.cleanup()
        except Exception:
            pass


__all__ = [
    "CAPTURED",
    "CANCELLED",
    "FAILED",
    "CaptureSessionResult",
    "run_capture_session",
]
