#!/usr/bin/env python3
"""Pi-local visual calibration for PSA Items 1, 6, and 13.

Run only while ``ocr-start.service`` is stopped. Images never leave the Pi.
"""

from __future__ import annotations

import argparse
import base64
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

import cv2
import numpy as np

from birth_station_calibration import save_birth_station_calibration
from extraction.psa_birth_row_cropper import PSABirthRowCropperConfig
from extraction.psa_birth_row_ocr import build_birth_cell_previews
from extraction.psa_form_registration import (
    register_psa_birth_form,
    register_psa_birth_form_grid_envelope,
)


ROW_LABELS = {
    "child_name": "Item 1 / Child",
    "mother_maiden_name": "Item 6 / Mother",
    "father_name": "Item 13 / Father",
}
COMPONENTS = ("first", "middle", "last")


def _photo(image: np.ndarray, maximum: tuple[int, int]) -> tk.PhotoImage:
    source = image
    if source.ndim == 2:
        source = cv2.cvtColor(source, cv2.COLOR_GRAY2BGR)
    height, width = source.shape[:2]
    scale = min(maximum[0] / width, maximum[1] / height, 1.0)
    shown = cv2.resize(source, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    success, encoded = cv2.imencode(".png", shown)
    if not success:
        raise ValueError("Unable to render calibration image")
    return tk.PhotoImage(data=base64.b64encode(encoded).decode("ascii"))


class BirthCalibrationApp:
    def __init__(self, root: tk.Tk, original: np.ndarray, registered: np.ndarray):
        self.root = root
        self.original = original
        self.registered = registered
        self.config = PSABirthRowCropperConfig()
        self.rows = [
            {
                "field_name": row[0],
                "left": row[1],
                "first_right": row[2],
                "middle_right": row[3],
                "right": row[4],
                "top": row[5],
                "bottom": row[6],
            }
            for row in self.config.row_geometries
        ]
        self.scale = min(850 / registered.shape[1], 700 / registered.shape[0])
        self.drag_target: tuple[int, str] | None = None
        self.selected = (1, "last")
        self.images: list[tk.PhotoImage] = []
        self._build()
        self._redraw()

    def _build(self) -> None:
        self.root.title("SMaRT-PDM PSA Birth Calibration — Pi local only")
        toolbar = ttk.Frame(self.root, padding=6)
        toolbar.pack(fill="x")
        ttk.Button(toolbar, text="Inspect original color", command=self._show_original).pack(side="left")
        ttk.Button(toolbar, text="Save calibration", command=self._save).pack(side="right")
        ttk.Label(
            toolbar,
            text="Drag colored borders. Click a cell to inspect original + 3 OCR variants.",
        ).pack(side="left", padx=12)

        body = ttk.Panedwindow(self.root, orient="horizontal")
        body.pack(fill="both", expand=True)
        left = ttk.Frame(body)
        right = ttk.Frame(body, padding=6)
        body.add(left, weight=3)
        body.add(right, weight=2)

        self.canvas = tk.Canvas(
            left,
            width=int(self.registered.shape[1] * self.scale),
            height=int(self.registered.shape[0] * self.scale),
            cursor="crosshair",
        )
        self.canvas.pack(fill="both", expand=True)
        self.canvas.bind("<Button-1>", self._press)
        self.canvas.bind("<B1-Motion>", self._drag)
        self.canvas.bind("<ButtonRelease-1>", lambda _event: self._refresh_previews())

        ttk.Label(right, text="Nine physical cells", font=("TkDefaultFont", 11, "bold")).pack(anchor="w")
        cell_frame = ttk.Frame(right)
        cell_frame.pack(fill="x", pady=4)
        for row_index, row in enumerate(self.rows):
            ttk.Label(cell_frame, text=ROW_LABELS[row["field_name"]]).grid(
                row=row_index * 2, column=0, columnspan=3, sticky="w", pady=(5, 0)
            )
            for column, component in enumerate(COMPONENTS):
                ttk.Button(
                    cell_frame,
                    text=component.title(),
                    command=lambda r=row_index, c=component: self._select(r, c),
                ).grid(row=row_index * 2 + 1, column=column, padx=2, sticky="ew")

        ttk.Separator(right).pack(fill="x", pady=6)
        self.preview_title = ttk.Label(right, text="", font=("TkDefaultFont", 10, "bold"))
        self.preview_title.pack(anchor="w")
        self.preview_frame = ttk.Frame(right)
        self.preview_frame.pack(fill="both", expand=True)

    def _registered_photo(self) -> tk.PhotoImage:
        return _photo(
            self.registered,
            (int(self.registered.shape[1] * self.scale), int(self.registered.shape[0] * self.scale)),
        )

    def _redraw(self) -> None:
        self.canvas.delete("all")
        image = self._registered_photo()
        self.images = [image]
        self.canvas.create_image(0, 0, image=image, anchor="nw")
        colors = ("#ef4444", "#f59e0b", "#2563eb")
        for index, row in enumerate(self.rows):
            color = colors[index]
            xs = [row["left"], row["first_right"], row["middle_right"], row["right"]]
            for x in xs:
                self.canvas.create_line(x * self.scale, row["top"] * self.scale,
                                        x * self.scale, row["bottom"] * self.scale,
                                        fill=color, width=3)
            for y in (row["top"], row["bottom"]):
                self.canvas.create_line(row["left"] * self.scale, y * self.scale,
                                        row["right"] * self.scale, y * self.scale,
                                        fill=color, width=3)
            self.canvas.create_text(
                row["left"] * self.scale + 4,
                row["top"] * self.scale - 9,
                text=ROW_LABELS[row["field_name"]],
                fill=color,
                anchor="w",
            )
        self._refresh_previews()

    def _nearest_target(self, x: float, y: float) -> tuple[int, str] | None:
        px, py = x / self.scale, y / self.scale
        candidates: list[tuple[float, int, str]] = []
        for index, row in enumerate(self.rows):
            if row["top"] - 20 <= py <= row["bottom"] + 20:
                for key in ("left", "first_right", "middle_right", "right"):
                    candidates.append((abs(px - row[key]), index, key))
            if row["left"] <= px <= row["right"]:
                for key in ("top", "bottom"):
                    candidates.append((abs(py - row[key]), index, key))
        if not candidates:
            return None
        distance, index, key = min(candidates)
        return (index, key) if distance <= 18 else None

    def _press(self, event: tk.Event) -> None:
        self.drag_target = self._nearest_target(event.x, event.y)

    def _drag(self, event: tk.Event) -> None:
        if self.drag_target is None:
            return
        index, key = self.drag_target
        row = self.rows[index]
        value = int(round((event.x if key not in ("top", "bottom") else event.y) / self.scale))
        if key in ("top", "bottom"):
            row[key] = max(0, min(self.registered.shape[0], value))
        else:
            row[key] = max(0, min(self.registered.shape[1], value))
        self._redraw()

    def _cell(self, row_index: int, component: str) -> np.ndarray:
        row = self.rows[row_index]
        boundaries = [row["left"], row["first_right"], row["middle_right"], row["right"]]
        column = COMPONENTS.index(component)
        return self.registered[
            row["top"]:row["bottom"],
            boundaries[column]:boundaries[column + 1],
        ].copy()

    def _select(self, row_index: int, component: str) -> None:
        self.selected = (row_index, component)
        self._refresh_previews()

    def _refresh_previews(self) -> None:
        for child in self.preview_frame.winfo_children():
            child.destroy()
        row_index, component = self.selected
        row = self.rows[row_index]
        self.preview_title.configure(text=f"{ROW_LABELS[row['field_name']]} — {component.title()}")
        crop = self._cell(row_index, component)
        if crop.size == 0:
            ttk.Label(self.preview_frame, text="Invalid crop geometry").pack()
            return
        try:
            variants = build_birth_cell_previews(crop)
        except Exception as exc:
            ttk.Label(self.preview_frame, text=f"Preview failed: {exc}").pack()
            return
        self.images = self.images[:1]
        for name, image in variants.items():
            ttk.Label(self.preview_frame, text=name.replace("_", " ").title()).pack(anchor="w")
            photo = _photo(image, (430, 120))
            self.images.append(photo)
            ttk.Label(self.preview_frame, image=photo).pack(fill="x", pady=(0, 5))

    def _show_original(self) -> None:
        window = tk.Toplevel(self.root)
        window.title("Zoomable original color Birth capture")
        toolbar = ttk.Frame(window, padding=5)
        toolbar.pack(fill="x")
        ttk.Label(toolbar, text="Zoom").pack(side="left")
        zoom = tk.DoubleVar(value=1.0)
        viewport = ttk.Frame(window)
        viewport.pack(fill="both", expand=True)
        canvas = tk.Canvas(viewport, width=1100, height=760)
        horizontal = ttk.Scrollbar(viewport, orient="horizontal", command=canvas.xview)
        vertical = ttk.Scrollbar(viewport, orient="vertical", command=canvas.yview)
        canvas.configure(xscrollcommand=horizontal.set, yscrollcommand=vertical.set)
        canvas.grid(row=0, column=0, sticky="nsew")
        vertical.grid(row=0, column=1, sticky="ns")
        horizontal.grid(row=1, column=0, sticky="ew")
        viewport.rowconfigure(0, weight=1)
        viewport.columnconfigure(0, weight=1)

        def render(*_args: object) -> None:
            factor = max(0.25, min(3.0, float(zoom.get())))
            height, width = self.original.shape[:2]
            resized = cv2.resize(
                self.original,
                (max(1, int(width * factor)), max(1, int(height * factor))),
                interpolation=cv2.INTER_CUBIC if factor > 1.0 else cv2.INTER_AREA,
            )
            photo = _photo(resized, (resized.shape[1], resized.shape[0]))
            canvas.delete("all")
            canvas.create_image(0, 0, image=photo, anchor="nw")
            canvas.configure(scrollregion=(0, 0, resized.shape[1], resized.shape[0]))
            canvas.image = photo

        for label, factor in (("50%", 0.5), ("100%", 1.0), ("150%", 1.5), ("200%", 2.0)):
            ttk.Button(
                toolbar,
                text=label,
                command=lambda value=factor: (zoom.set(value), render()),
            ).pack(side="left", padx=2)
        canvas.bind(
            "<Control-MouseWheel>",
            lambda event: (
                zoom.set(max(0.25, min(3.0, zoom.get() + (0.25 if event.delta > 0 else -0.25)))),
                render(),
            ),
        )
        render()

    def _save(self) -> None:
        try:
            path = save_birth_station_calibration(self.rows)
        except Exception as exc:
            messagebox.showerror("Invalid calibration", str(exc))
            return
        messagebox.showinfo("Calibration saved", f"Saved locally to:\n{path}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, help="Latest Pi-local Birth capture")
    args = parser.parse_args()
    original = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if original is None:
        raise SystemExit(f"Unable to read {args.image}")
    registration = register_psa_birth_form(original)
    if not registration.success:
        registration = register_psa_birth_form_grid_envelope(original)
    if not registration.success or registration.data is None:
        raise SystemExit("Birth grid registration failed; recapture the complete document first")
    root = tk.Tk()
    BirthCalibrationApp(root, original, registration.data.registered_image)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
