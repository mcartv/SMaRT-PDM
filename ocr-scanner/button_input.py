"""Reusable physical button input for Raspberry Pi capture sessions."""

import os
import struct
import time
from typing import BinaryIO, Callable, Optional

try:
    import fcntl
except ImportError:  # pragma: no cover - Linux-only runtime dependency
    fcntl = None


INPUT_DEVICE = os.getenv("INPUT_DEVICE", "/dev/input/event4")
DEBOUNCE_MS = int(os.getenv("DEBOUNCE_MS", "500"))
LEFT_CODE = 272
RIGHT_CODE = 273
_EVENT = struct.Struct("llHHI")


class ButtonReader:
    """Read deterministic LEFT/RIGHT release events without changing permissions."""

    def __init__(
        self,
        device_path: str = INPUT_DEVICE,
        *,
        file_opener: Callable[..., BinaryIO] = open,
        clock: Callable[[], float] = time.monotonic,
        sleeper: Callable[[float], None] = time.sleep,
        debounce_ms: int = DEBOUNCE_MS,
    ) -> None:
        self.device_path = device_path
        self._file_opener = file_opener
        self._clock = clock
        self._sleeper = sleeper
        self._debounce_seconds = max(0, debounce_ms) / 1000.0
        self._device_file: Optional[BinaryIO] = None
        self._last_press = {"left": float("-inf"), "right": float("-inf")}

    def start(self) -> None:
        if self._device_file is not None:
            return
        device_file = self._file_opener(self.device_path, "rb")
        try:
            if fcntl is not None:
                flags = fcntl.fcntl(device_file.fileno(), fcntl.F_GETFL)
                fcntl.fcntl(device_file.fileno(), fcntl.F_SETFL, flags | os.O_NONBLOCK)
        except Exception:
            device_file.close()
            raise
        self._device_file = device_file

    def close(self) -> None:
        if self._device_file is None:
            return
        try:
            self._device_file.close()
        finally:
            self._device_file = None

    stop = close

    def poll_press(self) -> Optional[str]:
        if self._device_file is None:
            return None
        try:
            data = self._device_file.read(_EVENT.size)
        except BlockingIOError:
            return None
        if not data or len(data) != _EVENT.size:
            return None

        _, _, event_type, event_code, event_value = _EVENT.unpack(data)
        if event_type != 1 or event_value != 0:
            return None

        button = None
        if event_code == LEFT_CODE:
            button = "left"
        elif event_code == RIGHT_CODE:
            button = "right"
        if button is None:
            return None

        now = self._clock()
        if now - self._last_press[button] <= self._debounce_seconds:
            return None
        self._last_press[button] = now
        return button

    def wait_for_press(
        self,
        *,
        should_stop: Optional[Callable[[], bool]] = None,
    ) -> str:
        while True:
            if should_stop is not None and should_stop():
                raise InterruptedError("capture session interrupted")
            pressed = self.poll_press()
            if pressed is not None:
                return pressed
            self._sleeper(0.01)


__all__ = ["ButtonReader", "INPUT_DEVICE", "LEFT_CODE", "RIGHT_CODE"]
