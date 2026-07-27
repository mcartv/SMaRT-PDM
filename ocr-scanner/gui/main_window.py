"""Full-screen, read-only Tkinter window for OCR worker visualization."""

from __future__ import annotations

import os
import tkinter as tk
from tkinter import ttk
from typing import Dict

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


class ScannerStatusWindow:
    """Render state snapshots without issuing worker commands."""

    def __init__(self, root: tk.Tk, *, state_reader: StateReader) -> None:
        self.root = root
        self.state_reader = state_reader
        self._after_id = None
        self._last_model = None
        self._tone_widgets: Dict[str, tk.Widget] = {}

        self._configure_root()
        self._configure_styles()
        self._build_layout()
        self._schedule_refresh(immediate=True)

    def _configure_root(self) -> None:
        self.root.title("SMaRT-PDM Document Scanner")
        self.root.configure(background=COLORS["cream"])
        self.root.attributes("-fullscreen", True)
        self.root.minsize(800, 480)
        self.root.config(cursor="none")
        self.root.protocol("WM_DELETE_WINDOW", self._ignore_close)

        if os.getenv("SMART_PDM_GUI_ALLOW_ESCAPE", "0") == "1":
            self.root.bind("<Escape>", lambda _event: self.close())

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
            thickness=18,
        )

    def _build_layout(self) -> None:
        self.root.grid_rowconfigure(1, weight=1)
        self.root.grid_columnconfigure(0, weight=1)

        header = tk.Frame(self.root, bg=COLORS["brown"], padx=34, pady=18)
        header.grid(row=0, column=0, sticky="nsew")
        header.grid_columnconfigure(0, weight=1)

        brand = tk.Frame(header, bg=COLORS["brown"])
        brand.grid(row=0, column=0, sticky="w")

        tk.Label(
            brand,
            text="SMaRT-PDM",
            bg=COLORS["brown"],
            fg="white",
            font=("DejaVu Sans", 22, "bold"),
        ).pack(anchor="w")
        tk.Label(
            brand,
            text="Scholarship Document Scanner",
            bg=COLORS["brown"],
            fg="#F4E7DA",
            font=("DejaVu Sans", 11),
        ).pack(anchor="w", pady=(2, 0))

        self.connection_badge = tk.Label(
            header,
            text="WORKER OFFLINE",
            bg=COLORS["brown_dark"],
            fg="white",
            padx=18,
            pady=8,
            font=("DejaVu Sans", 11, "bold"),
        )
        self.connection_badge.grid(row=0, column=1, sticky="e")

        content = tk.Frame(self.root, bg=COLORS["cream"], padx=42, pady=34)
        content.grid(row=1, column=0, sticky="nsew")
        content.grid_columnconfigure(0, weight=3)
        content.grid_columnconfigure(1, weight=2)
        content.grid_rowconfigure(0, weight=1)

        self.status_card = tk.Frame(
            content,
            bg=COLORS["paper"],
            highlightbackground=COLORS["border"],
            highlightthickness=1,
            padx=34,
            pady=30,
        )
        self.status_card.grid(row=0, column=0, sticky="nsew", padx=(0, 18))
        self.status_card.grid_columnconfigure(0, weight=1)

        self.status_kicker = tk.Label(
            self.status_card,
            text="CURRENT STATUS",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 10, "bold"),
        )
        self.status_kicker.grid(row=0, column=0, sticky="w")

        self.status_title = tk.Label(
            self.status_card,
            text="Waiting for worker",
            bg=COLORS["paper"],
            fg=COLORS["text"],
            font=("DejaVu Sans", 30, "bold"),
            justify="left",
            anchor="w",
            wraplength=720,
        )
        self.status_title.grid(row=1, column=0, sticky="ew", pady=(12, 8))

        self.status_message = tk.Label(
            self.status_card,
            text="The OCR worker has not published its status yet.",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 15),
            justify="left",
            anchor="w",
            wraplength=720,
        )
        self.status_message.grid(row=2, column=0, sticky="ew", pady=(0, 26))

        self.progress = ttk.Progressbar(
            self.status_card,
            orient="horizontal",
            mode="determinate",
            maximum=100,
            style="Scanner.Horizontal.TProgressbar",
        )
        self.progress.grid(row=3, column=0, sticky="ew")

        self.progress_label = tk.Label(
            self.status_card,
            text="0%",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 10, "bold"),
        )
        self.progress_label.grid(row=4, column=0, sticky="e", pady=(7, 18))

        guidance = tk.Frame(
            self.status_card,
            bg="#F3E7D9",
            padx=20,
            pady=18,
        )
        guidance.grid(row=5, column=0, sticky="ew", pady=(12, 0))
        guidance.grid_columnconfigure(0, weight=1)
        tk.Label(
            guidance,
            text="Physical controls remain authoritative",
            bg="#F3E7D9",
            fg=COLORS["brown_dark"],
            font=("DejaVu Sans", 12, "bold"),
        ).grid(row=0, column=0, sticky="w")
        tk.Label(
            guidance,
            text=(
                "Use the physical capture button when the camera preview is ready. "
                "This screen does not claim requests, capture images, or submit results."
            ),
            bg="#F3E7D9",
            fg=COLORS["brown_dark"],
            font=("DejaVu Sans", 11),
            justify="left",
            anchor="w",
            wraplength=680,
        ).grid(row=1, column=0, sticky="ew", pady=(5, 0))

        detail_card = tk.Frame(
            content,
            bg=COLORS["paper"],
            highlightbackground=COLORS["border"],
            highlightthickness=1,
            padx=28,
            pady=26,
        )
        detail_card.grid(row=0, column=1, sticky="nsew", padx=(18, 0))
        detail_card.grid_columnconfigure(0, weight=1)

        tk.Label(
            detail_card,
            text="REQUEST DETAILS",
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 10, "bold"),
        ).grid(row=0, column=0, sticky="w", pady=(0, 18))

        self.document_value = self._detail_row(
            detail_card, 1, "Document", "No active document"
        )
        self.application_value = self._detail_row(
            detail_card, 2, "Application", "Not available"
        )
        self.request_value = self._detail_row(
            detail_card, 3, "Request", "Not available"
        )
        self.camera_value = self._detail_row(
            detail_card, 4, "Camera", "Unavailable"
        )
        self.updated_value = self._detail_row(
            detail_card, 5, "Last update", "Not available"
        )
        self.error_value = self._detail_row(
            detail_card, 6, "System note", "State file unavailable"
        )

        footer = tk.Frame(self.root, bg=COLORS["brown_dark"], padx=34, pady=11)
        footer.grid(row=2, column=0, sticky="nsew")
        footer.grid_columnconfigure(0, weight=1)
        tk.Label(
            footer,
            text="Read-only device visualization • OCR continues independently",
            bg=COLORS["brown_dark"],
            fg="#F4E7DA",
            font=("DejaVu Sans", 10),
        ).grid(row=0, column=0, sticky="w")
        tk.Label(
            footer,
            text="SMaRT-PDM",
            bg=COLORS["brown_dark"],
            fg="white",
            font=("DejaVu Sans", 10, "bold"),
        ).grid(row=0, column=1, sticky="e")

    def _detail_row(
        self,
        parent: tk.Frame,
        row: int,
        label: str,
        initial_value: str,
    ) -> tk.Label:
        frame = tk.Frame(parent, bg=COLORS["paper"])
        frame.grid(row=row, column=0, sticky="ew", pady=(0, 18))
        frame.grid_columnconfigure(0, weight=1)
        tk.Label(
            frame,
            text=label.upper(),
            bg=COLORS["paper"],
            fg=COLORS["muted"],
            font=("DejaVu Sans", 9, "bold"),
        ).grid(row=0, column=0, sticky="w")
        value = tk.Label(
            frame,
            text=initial_value,
            bg=COLORS["paper"],
            fg=COLORS["text"],
            font=("DejaVu Sans", 13, "bold"),
            justify="left",
            anchor="w",
            wraplength=420,
        )
        value.grid(row=1, column=0, sticky="ew", pady=(4, 0))
        return value

    def _schedule_refresh(self, *, immediate: bool = False) -> None:
        delay = 0 if immediate else POLL_INTERVAL_MS
        self._after_id = self.root.after(delay, self._refresh)

    def _refresh(self) -> None:
        result = self.state_reader.read()
        model = build_view_model(result)
        if model != self._last_model:
            self._apply_model(model)
            self._last_model = model
        self._schedule_refresh()

    def _apply_model(self, model: GuiViewModel) -> None:
        tone_color = COLORS.get(model.tone, COLORS["active"])
        self.connection_badge.configure(
            text=model.connection_status.upper(),
            bg=tone_color,
        )
        self.status_kicker.configure(fg=tone_color)
        self.status_title.configure(text=model.title)
        self.status_message.configure(text=model.message)
        self.progress["value"] = model.progress_percent
        self.progress_label.configure(text=f"{model.progress_percent}%")
        self.document_value.configure(text=model.document_label)
        self.application_value.configure(text=model.application_reference)
        self.request_value.configure(text=model.request_reference)
        self.camera_value.configure(text=model.camera_label)
        self.updated_value.configure(text=model.updated_label)
        self.error_value.configure(text=model.error_label)

    def _ignore_close(self) -> None:
        return None

    def close(self) -> None:
        if self._after_id is not None:
            try:
                self.root.after_cancel(self._after_id)
            except tk.TclError:
                pass
        self.root.destroy()


__all__ = ["COLORS", "POLL_INTERVAL_MS", "ScannerStatusWindow"]
