"""Balanced full-screen, read-only Tkinter UI for the Pi OCR station."""

from __future__ import annotations

import os
import tkinter as tk
from tkinter import ttk
from typing import Dict

from gui.single_line_label import SingleLineLabel
from gui.state_reader import StateReader
from gui.view_model import GuiViewModel, build_view_model

POLL_INTERVAL_MS = 250

COLORS = {
    "brown": "#744A2F",
    "brown_dark": "#4D2E1E",
    "cream": "#F7F2EA",
    "paper": "#FFFDF9",
    "gold": "#D49A2A",
    "text": "#2B211B",
    "muted": "#7E746D",
    "border": "#DED3C8",
    "success": "#2E7D32",
    "danger": "#B23A32",
    "attention": "#C67A12",
    "ready": "#2F6F55",
    "active": "#2E5E9E",
    "track": "#E8DED4",
}


class StatusDot(tk.Canvas):
    def __init__(self, master, *, color: str) -> None:
        super().__init__(
            master,
            width=10,
            height=10,
            bg=COLORS["paper"],
            highlightthickness=0,
            bd=0,
        )
        self._dot = self.create_oval(1, 1, 9, 9, fill=color, outline=color)

    def set_color(self, color: str) -> None:
        self.itemconfigure(self._dot, fill=color, outline=color)


class ScannerStatusWindow:
    """Render status snapshots without controlling any scanner operation."""

    def __init__(self, root: tk.Tk, *, state_reader: StateReader) -> None:
        self.root = root
        self.state_reader = state_reader
        self._after_id = None
        self._last_model = None
        self._yielding_to_camera_preview = False
        self._status_values: Dict[str, SingleLineLabel] = {}
        self._status_dots: Dict[str, StatusDot] = {}
        self._configure_root()
        self._configure_styles()
        self._build_layout()
        self._schedule_refresh(immediate=True)

    def _configure_root(self) -> None:
        self.root.title("SMaRT-PDM OCR Station")
        self.root.configure(background=COLORS["cream"])
        self.root.attributes("-fullscreen", True)
        self.root.minsize(800, 480)
        self.root.config(cursor="none")
        self.root.protocol("WM_DELETE_WINDOW", self._ignore_close)
        self.root.after_idle(self._enforce_kiosk_window)
        if os.getenv("SMART_PDM_GUI_ALLOW_ESCAPE", "0") == "1":
            self.root.bind("<Escape>", lambda _event: self.close())

    def _enforce_kiosk_window(self) -> None:
        """Apply fullscreen again after mapping for Pi XWayland compositors."""
        if self._yielding_to_camera_preview:
            return
        width = self.root.winfo_screenwidth()
        height = self.root.winfo_screenheight()
        self.root.overrideredirect(True)
        self.root.geometry(f"{width}x{height}+0+0")
        self.root.attributes("-fullscreen", True)
        self.root.lift()

    def _set_camera_preview_mode(self, active: bool) -> None:
        """Yield the HDMI display while rpicam owns the live preview."""
        if active == self._yielding_to_camera_preview:
            return
        self._yielding_to_camera_preview = active
        if active:
            self.root.withdraw()
            return
        self.root.deiconify()
        self.root.after_idle(self._enforce_kiosk_window)

    def _configure_styles(self) -> None:
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(
            "Scanner.Horizontal.TProgressbar",
            troughcolor=COLORS["track"],
            background=COLORS["gold"],
            bordercolor=COLORS["track"],
            lightcolor=COLORS["gold"],
            darkcolor=COLORS["gold"],
            thickness=14,
        )

    def _label(self, parent, text, **kwargs) -> SingleLineLabel:
        return SingleLineLabel(parent, text=text, **kwargs)

    def _build_layout(self) -> None:
        self.root.grid_rowconfigure(1, weight=1)
        self.root.grid_columnconfigure(0, weight=1)

        header = tk.Frame(self.root, bg=COLORS["brown"], padx=22, pady=10)
        header.grid(row=0, column=0, sticky="nsew")
        header.grid_columnconfigure(0, weight=1)

        brand = tk.Frame(header, bg=COLORS["brown"])
        brand.grid(row=0, column=0, sticky="ew")
        brand.grid_columnconfigure(0, weight=1)
        self._label(
            brand,
            "SMaRT-PDM OCR Station",
            bg=COLORS["brown"],
            fg="white",
            font=("DejaVu Sans", 22, "bold"),
            anchor="w",
        ).grid(row=0, column=0, sticky="ew")
        self._label(
            brand,
            "Document Processing Station",
            bg=COLORS["brown"],
            fg="#F4E7DA",
            font=("DejaVu Sans", 11),
            anchor="w",
        ).grid(row=1, column=0, sticky="ew", pady=(2, 0))

        self.internet_badge = self._label(
            header,
            "STATUS UNAVAILABLE",
            bg=COLORS["muted"],
            fg="white",
            padx=15,
            pady=6,
            font=("DejaVu Sans", 11, "bold"),
            anchor="center",
        )
        self.internet_badge.grid(row=0, column=1, sticky="e", padx=(18, 0))

        content = tk.Frame(self.root, bg=COLORS["cream"], padx=22, pady=14)
        content.grid(row=1, column=0, sticky="nsew")
        content.grid_columnconfigure(0, weight=3, uniform="content")
        content.grid_columnconfigure(1, weight=2, uniform="content")
        content.grid_rowconfigure(0, weight=1)

        activity_card = tk.Frame(
            content,
            bg=COLORS["paper"],
            highlightbackground=COLORS["border"],
            highlightthickness=1,
            padx=22,
            pady=18,
        )
        activity_card.grid(row=0, column=0, sticky="nsew", padx=(0, 9))
        activity_card.grid_columnconfigure(0, weight=1)
        activity_card.grid_rowconfigure(2, weight=1)

        self.activity_kicker = self._label(
            activity_card,
            "CURRENT SCANNER ACTIVITY",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 10, "bold"),
            anchor="w",
        )
        self.activity_kicker.grid(row=0, column=0, sticky="ew")
        self.activity_value = self._label(
            activity_card,
            "Waiting for status",
            bg=COLORS["paper"],
            fg=COLORS["text"],
            font=("DejaVu Sans", 26, "bold"),
            anchor="w",
        )
        self.activity_value.grid(row=1, column=0, sticky="ew", pady=(8, 3))
        self.document_value = self._label(
            activity_card,
            "No active document",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 15),
            anchor="w",
        )
        self.document_value.grid(row=2, column=0, sticky="new", pady=(0, 14))

        self.progress = ttk.Progressbar(
            activity_card,
            orient="horizontal",
            mode="determinate",
            maximum=100,
            style="Scanner.Horizontal.TProgressbar",
        )
        self.progress.grid(row=3, column=0, sticky="ew")
        self.progress_label = self._label(
            activity_card,
            "0%",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 10, "bold"),
            anchor="e",
        )
        self.progress_label.grid(row=4, column=0, sticky="ew", pady=(4, 10))

        detail_strip = tk.Frame(activity_card, bg="#F3E7D9", padx=13, pady=9)
        detail_strip.grid(row=5, column=0, sticky="ew")
        detail_strip.grid_columnconfigure(0, weight=1)
        detail_strip.grid_columnconfigure(1, weight=1)
        self.camera_value = self._label(
            detail_strip,
            "Camera: Unavailable",
            bg="#F3E7D9",
            fg=COLORS["brown_dark"],
            font=("DejaVu Sans", 11, "bold"),
            anchor="w",
        )
        self.camera_value.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.updated_value = self._label(
            detail_strip,
            "Updated: Not available",
            bg="#F3E7D9",
            fg=COLORS["brown_dark"],
            font=("DejaVu Sans", 11),
            anchor="e",
        )
        self.updated_value.grid(row=0, column=1, sticky="ew", padx=(8, 0))

        system_card = tk.Frame(
            content,
            bg=COLORS["paper"],
            highlightbackground=COLORS["border"],
            highlightthickness=1,
            padx=19,
            pady=17,
        )
        system_card.grid(row=0, column=1, sticky="nsew", padx=(9, 0))
        system_card.grid_columnconfigure(0, weight=1)
        self._label(
            system_card,
            "SYSTEM STATUS",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 10, "bold"),
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", pady=(0, 6))
        self._status_row(system_card, 1, "internet", "Internet", "Checking")
        self._status_row(system_card, 2, "backend", "SMaRT-PDM", "Checking")
        self._status_row(system_card, 3, "worker", "OCR Worker", "Offline")

        self.system_note = self._label(
            system_card,
            "Starting device monitor",
            bg="#F5F1EC",
            fg=COLORS["muted"],
            padx=11,
            pady=8,
            font=("DejaVu Sans", 10),
            anchor="w",
        )
        self.system_note.grid(row=4, column=0, sticky="sew", pady=(9, 0))
        system_card.grid_rowconfigure(4, weight=1)

        footer = tk.Frame(self.root, bg=COLORS["brown_dark"], padx=22, pady=8)
        footer.grid(row=2, column=0, sticky="nsew")
        footer.grid_columnconfigure(0, weight=1)
        self._label(
            footer,
            "Use the physical capture button when the preview is ready",
            bg=COLORS["brown_dark"],
            fg="#F4E7DA",
            font=("DejaVu Sans", 10),
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=(0, 12))
        self._label(
            footer,
            "Read-only status",
            bg=COLORS["brown_dark"],
            fg="white",
            font=("DejaVu Sans", 10, "bold"),
            anchor="e",
        ).grid(row=0, column=1, sticky="e")

    def _status_row(self, parent, row: int, key: str, label: str, value: str) -> None:
        frame = tk.Frame(parent, bg=COLORS["paper"], pady=8)
        frame.grid(row=row, column=0, sticky="ew")
        frame.grid_columnconfigure(1, weight=1)
        dot = StatusDot(frame, color=COLORS["muted"])
        dot.grid(row=0, column=0, rowspan=2, sticky="w", padx=(0, 10))
        self._status_dots[key] = dot
        self._label(
            frame,
            label.upper(),
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 9, "bold"),
            anchor="w",
        ).grid(row=0, column=1, sticky="ew")
        status_value = self._label(
            frame,
            value,
            bg=COLORS["paper"],
            fg=COLORS["text"],
            font=("DejaVu Sans", 15, "bold"),
            anchor="w",
        )
        status_value.grid(row=1, column=1, sticky="ew", pady=(2, 0))
        self._status_values[key] = status_value

    def _schedule_refresh(self, *, immediate: bool = False) -> None:
        self._after_id = self.root.after(0 if immediate else POLL_INTERVAL_MS, self._refresh)

    def _refresh(self) -> None:
        model = build_view_model(self.state_reader.read())
        if model != self._last_model:
            self._apply_model(model)
            self._last_model = model
        self._schedule_refresh()

    def _apply_model(self, model: GuiViewModel) -> None:
        self._set_camera_preview_mode(model.camera_preview_active)
        self.internet_badge.set_text(model.internet_badge)
        self.internet_badge.configure(bg=COLORS.get(model.internet_tone, COLORS["muted"]))
        self.activity_kicker.configure(fg=COLORS.get(model.activity_tone, COLORS["muted"]))
        self.activity_value.set_text(model.activity_text)
        self.document_value.set_text(model.document_label)
        self.progress["value"] = model.progress_percent
        self.progress_label.set_text(f"{model.progress_percent}%")
        self.camera_value.set_text(f"Camera: {model.camera_label}")
        self.updated_value.set_text(f"Updated: {model.updated_label}")
        self.system_note.set_text(model.system_note)
        values = {
            "internet": (model.internet_status, model.internet_tone),
            "backend": (model.backend_status, model.backend_tone),
            "worker": (model.worker_status, model.worker_tone),
        }
        for key, (text, tone) in values.items():
            self._status_values[key].set_text(text)
            self._status_values[key].configure(fg=COLORS.get(tone, COLORS["text"]))
            self._status_dots[key].set_color(COLORS.get(tone, COLORS["muted"]))

    def _ignore_close(self) -> None:
        return None

    def close(self) -> None:
        if self._after_id is not None:
            try:
                self.root.after_cancel(self._after_id)
            except tk.TclError:
                pass
        self.root.destroy()


__all__ = ["COLORS", "POLL_INTERVAL_MS", "ScannerStatusWindow", "StatusDot"]
