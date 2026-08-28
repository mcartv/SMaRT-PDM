#!/usr/bin/env python3
"""Entrypoint for the read-only Raspberry Pi scanner status GUI."""

from __future__ import annotations

import logging
import tkinter as tk

from gui.main_window import ScannerStatusWindow
from gui.state_reader import StateReader


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    try:
        root = tk.Tk()
    except tk.TclError:
        logging.getLogger("smart-pdm-gui").error("GUI startup failed code=display_unavailable")
        return 1
    ScannerStatusWindow(root, state_reader=StateReader())
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
