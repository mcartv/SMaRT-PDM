"""Stable-font, single-line Tk label with pixel-based overflow ellipsis."""

from __future__ import annotations

import tkinter as tk
from tkinter import font as tkfont
from typing import Callable

ELLIPSIS = "…"


def ellipsize_text(
    text: object,
    maximum_pixels: int,
    measure: Callable[[str], int],
) -> str:
    value = " ".join(str(text or "").split())
    if maximum_pixels <= 0 or not value:
        return ""
    if measure(value) <= maximum_pixels:
        return value
    if measure(ELLIPSIS) > maximum_pixels:
        return ""
    low = 0
    high = len(value)
    while low < high:
        midpoint = (low + high + 1) // 2
        candidate = value[:midpoint].rstrip() + ELLIPSIS
        if measure(candidate) <= maximum_pixels:
            low = midpoint
        else:
            high = midpoint - 1
    return value[:low].rstrip() + ELLIPSIS


class SingleLineLabel(tk.Label):
    """A label that never wraps or changes font size to fit its content."""

    def __init__(self, master=None, *, text: object = "", **kwargs) -> None:
        kwargs.pop("wraplength", None)
        normalized = " ".join(str(text or "").split())
        super().__init__(master, text=normalized, **kwargs)
        self._full_text = normalized
        self._font = tkfont.Font(font=self.cget("font"))
        self.bind("<Configure>", self._on_resize, add="+")
        self.after_idle(self._render)

    @property
    def full_text(self) -> str:
        return self._full_text

    def set_text(self, text: object) -> None:
        normalized = " ".join(str(text or "").split())
        if normalized == self._full_text:
            return
        self._full_text = normalized
        tk.Label.configure(self, text=normalized)
        self.after_idle(self._render)

    def _on_resize(self, _event=None) -> None:
        self._render()

    def _render(self) -> None:
        try:
            if not self.winfo_ismapped():
                return
            horizontal_padding = self.winfo_pixels(str(self.cget("padx")))
            available = max(0, self.winfo_width() - (2 * horizontal_padding) - 4)
            if available <= 0:
                return
            rendered = ellipsize_text(self._full_text, available, self._font.measure)
            tk.Label.configure(self, text=rendered)
        except tk.TclError:
            return


__all__ = ["ELLIPSIS", "SingleLineLabel", "ellipsize_text"]
