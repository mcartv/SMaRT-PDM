"""Reliable physical button input v3 for Raspberry Pi capture sessions."""

from __future__ import annotations

import glob
import os
import posixpath
import struct
import time
from pathlib import Path
from typing import BinaryIO, Callable, Iterable, Optional

try:
    import fcntl
except ImportError:  # pragma: no cover - Linux-only runtime dependency
    fcntl = None


DEFAULT_INPUT_DEVICE = "/dev/input/event4"
DEBOUNCE_MS = int(os.getenv("DEBOUNCE_MS", "500"))
LEFT_CODE = 272
RIGHT_CODE = 273
_EVENT = struct.Struct("llHHI")

_EV_KEY = 0x01
_KEY_MAX = 0x2FF
_IOC_NRBITS = 8
_IOC_TYPEBITS = 8
_IOC_SIZEBITS = 14
_IOC_NRSHIFT = 0
_IOC_TYPESHIFT = _IOC_NRSHIFT + _IOC_NRBITS
_IOC_SIZESHIFT = _IOC_TYPESHIFT + _IOC_TYPEBITS
_IOC_DIRSHIFT = _IOC_SIZESHIFT + _IOC_SIZEBITS
_IOC_READ = 2


def _ioc(direction: int, type_value: int, number: int, size: int) -> int:
    return (
        (direction << _IOC_DIRSHIFT)
        | (type_value << _IOC_TYPESHIFT)
        | (number << _IOC_NRSHIFT)
        | (size << _IOC_SIZESHIFT)
    )


def _eviocgbit(event_type: int, length: int) -> int:
    return _ioc(
        _IOC_READ,
        ord("E"),
        0x20 + event_type,
        length,
    )


def _bit_is_set(bitmap: bytearray, code: int) -> bool:
    byte_index = code // 8
    bit_index = code % 8

    return (
        0 <= byte_index < len(bitmap)
        and bool(bitmap[byte_index] & (1 << bit_index))
    )


def _supports_button_codes(path: str) -> bool:
    """Return whether an event node advertises both capture buttons."""

    if fcntl is None:
        return False

    try:
        with open(path, "rb", buffering=0) as device:
            bitmap = bytearray((_KEY_MAX + 8) // 8)
            fcntl.ioctl(
                device.fileno(),
                _eviocgbit(_EV_KEY, len(bitmap)),
                bitmap,
                True,
            )
    except (OSError, ValueError, AttributeError):
        return False

    return (
        _bit_is_set(bitmap, LEFT_CODE)
        and _bit_is_set(bitmap, RIGHT_CODE)
    )


def _canonical_device_path(value: str) -> str:
    """
    Canonicalize an input-device path without converting Linux /dev paths
    into Windows drive paths during local source validation.
    """

    text = str(value or "").strip()

    if not text:
        return ""

    if os.name != "posix" and text.startswith("/dev/"):
        return posixpath.normpath(text)

    return os.path.realpath(text)


def _candidate_input_devices(
    configured: Optional[str] = None,
) -> Iterable[str]:
    seen: set[str] = set()

    patterns = (
        "/dev/input/by-id/*-event-mouse",
        "/dev/input/by-path/*-event-mouse",
        "/dev/input/event*",
    )

    values = [
        configured,
        os.getenv("INPUT_DEVICE", "").strip(),
        DEFAULT_INPUT_DEVICE,
    ]

    for pattern in patterns:
        values.extend(sorted(glob.glob(pattern)))

    for raw_value in values:
        value = str(raw_value or "").strip()

        if not value:
            continue

        resolved = _canonical_device_path(value)

        if resolved in seen:
            continue

        seen.add(resolved)
        yield resolved


def resolve_input_device(
    configured: Optional[str] = None,
) -> str:
    """
    Resolve the capture-button event device deterministically.

    An explicitly supplied path or INPUT_DEVICE value is trusted when it is
    readable. Automatic discovery never assumes event4 is correct: it scans
    all readable candidates for LEFT_CODE and RIGHT_CODE support first, then
    falls back to the first readable node only when capability probing is not
    possible or no supported node is found.
    """

    configured_value = str(configured or "").strip()
    environment_value = os.getenv("INPUT_DEVICE", "").strip()
    explicit_value = configured_value or environment_value

    candidates = list(
        _candidate_input_devices(configured)
    )

    if not candidates:
        return DEFAULT_INPUT_DEVICE

    if explicit_value:
        explicit_path = _canonical_device_path(explicit_value)

        if (
            os.path.exists(explicit_path)
            and os.access(explicit_path, os.R_OK)
        ):
            return explicit_path

    readable_candidates = [
        candidate
        for candidate in candidates
        if (
            os.path.exists(candidate)
            and os.access(candidate, os.R_OK)
        )
    ]

    for candidate in readable_candidates:
        if _supports_button_codes(candidate):
            return candidate

    if readable_candidates:
        return readable_candidates[0]

    return candidates[0]


class ButtonReader:
    """Read deterministic LEFT/RIGHT release events without permission changes."""

    def __init__(
        self,
        device_path: Optional[str] = None,
        *,
        file_opener: Callable[..., BinaryIO] = open,
        clock: Callable[[], float] = time.monotonic,
        sleeper: Callable[[float], None] = time.sleep,
        debounce_ms: int = DEBOUNCE_MS,
    ) -> None:
        self.device_path = (
            str(device_path).strip()
            if device_path is not None
            else None
        )
        self._file_opener = file_opener
        self._uses_default_opener = file_opener is open
        self._clock = clock
        self._sleeper = sleeper
        self._debounce_seconds = max(0, debounce_ms) / 1000.0
        self._device_file: Optional[BinaryIO] = None
        self._last_press = {
            "left": float("-inf"),
            "right": float("-inf"),
        }

    def _resolved_path(self) -> str:
        if self.device_path:
            return self.device_path

        # Unit tests and injected streams must never inspect host hardware.
        if not self._uses_default_opener:
            return os.getenv(
                "INPUT_DEVICE",
                DEFAULT_INPUT_DEVICE,
            )

        return resolve_input_device()

    def start(self) -> None:
        if self._device_file is not None:
            return

        resolved = self._resolved_path()
        device_file = self._file_opener(resolved, "rb")

        try:
            if fcntl is not None:
                flags = fcntl.fcntl(
                    device_file.fileno(),
                    fcntl.F_GETFL,
                )
                fcntl.fcntl(
                    device_file.fileno(),
                    fcntl.F_SETFL,
                    flags | os.O_NONBLOCK,
                )
        except (AttributeError, OSError, ValueError):
            # Injected BytesIO-like readers need no file-descriptor flags.
            if self._uses_default_opener:
                device_file.close()
                raise

        self.device_path = resolved
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

        (
            _seconds,
            _microseconds,
            event_type,
            event_code,
            event_value,
        ) = _EVENT.unpack(data)

        if event_type != 1 or event_value != 0:
            return None

        if event_code == LEFT_CODE:
            button = "left"
        elif event_code == RIGHT_CODE:
            button = "right"
        else:
            return None

        now = self._clock()

        if (
            now - self._last_press[button]
            <= self._debounce_seconds
        ):
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
                raise InterruptedError(
                    "capture session interrupted"
                )

            pressed = self.poll_press()

            if pressed is not None:
                return pressed

            self._sleeper(0.01)


INPUT_DEVICE = os.getenv(
    "INPUT_DEVICE",
    DEFAULT_INPUT_DEVICE,
)

__all__ = [
    "ButtonReader",
    "DEFAULT_INPUT_DEVICE",
    "INPUT_DEVICE",
    "LEFT_CODE",
    "RIGHT_CODE",
    "resolve_input_device",
]
