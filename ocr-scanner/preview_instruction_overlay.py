#!/usr/bin/env python3
"""Local privacy-safe instruction overlay for the live camera preview."""

from __future__ import annotations

import signal
import tkinter as tk


MESSAGE = "READY TO CAPTURE?  PRESS THE LEFT BUTTON"


def main() -> int:
    root = tk.Tk()
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    root.configure(background="#111111")
    root.geometry("+24+24")

    label = tk.Label(
        root,
        text=MESSAGE,
        background="#111111",
        foreground="#FFD400",
        font=("DejaVu Sans", 18, "bold"),
        padx=18,
        pady=12,
    )
    label.pack()

    def close(_signal_number=None, _frame=None) -> None:
        try:
            root.after(0, root.destroy)
        except tk.TclError:
            pass

    signal.signal(signal.SIGTERM, close)
    signal.signal(signal.SIGINT, close)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
