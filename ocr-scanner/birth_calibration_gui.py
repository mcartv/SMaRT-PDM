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

from birth_station_calibration import (
    load_birth_station_calibration,
    normalized_corners_from_homography,
    save_birth_station_calibration,
    validate_normalized_corners,
    warp_birth_station_capture,
)
from extraction.psa_birth_row_cropper import (
    PSABirthRowCropperConfig,
    crop_psa_birth_name_rows,
    validate_psa_birth_name_topology,
)
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
BIRTH_RELAXED_REGISTRATION_CONFIG = {
    "review_horizontal_lines": 5,
    "review_vertical_lines": 2,
    "boundary_search_distance": 0.14,
    "line_cluster_distance": 0.009,
    "review_corner_deviation": 0.09,
    "maximum_extended_corner_deviation": 0.13,
    "review_opposite_edge_ratio": 1.35,
    "review_canonical_edge_deviation": 0.03,
    "registered_line_minimum_coverage": 0.16,
}


class ManualCornerApp:
    """Manual source-document registration used when automatic modes fail."""

    COLORS = ("#ef4444", "#22c55e", "#3b82f6", "#f59e0b")
    LABELS = ("Top left", "Top right", "Bottom right", "Bottom left")

    def __init__(self, root, original, *, initial_corners=None,
                 initial_config=None, calibration_status="repository_default"):
        self.root = root
        self.original = original
        self.initial_config = initial_config
        self.calibration_status = calibration_status
        self.corners = [list(point) for point in (initial_corners or (
            (0.12, 0.06), (0.88, 0.06), (0.88, 0.94), (0.12, 0.94),
        ))]
        height, width = original.shape[:2]
        self.scale = min(1100 / width, 760 / height, 1.0)
        self.shown_width = int(width * self.scale)
        self.shown_height = int(height * self.scale)
        self.drag_index = None
        self.photo = _photo(original, (self.shown_width, self.shown_height))
        self._build()
        self._redraw()

    def _build(self):
        self.root.title("SMaRT-PDM PSA Birth Manual Registration - Pi local only")
        toolbar = ttk.Frame(self.root, padding=8)
        toolbar.pack(fill="x")
        ttk.Label(toolbar, text=(
            "Drag the four markers onto the outer corners of the PSA form, "
            "then preview the corrected canvas."
        )).pack(side="left")
        ttk.Button(toolbar, text="Preview registered canvas", command=self._apply).pack(side="right")
        self.canvas = tk.Canvas(self.root, width=self.shown_width,
                                height=self.shown_height, cursor="crosshair")
        self.canvas.pack(fill="both", expand=True)
        self.canvas.bind("<Button-1>", self._press)
        self.canvas.bind("<B1-Motion>", self._drag)

    def _point_pixels(self, point):
        return point[0] * self.shown_width, point[1] * self.shown_height

    def _redraw(self):
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, image=self.photo, anchor="nw")
        pixels = [self._point_pixels(point) for point in self.corners]
        self.canvas.create_polygon(
            *(coordinate for point in pixels for coordinate in point),
            outline="#f43f5e", fill="", width=3,
        )
        for (x, y), color, label in zip(pixels, self.COLORS, self.LABELS):
            self.canvas.create_oval(x - 10, y - 10, x + 10, y + 10,
                                    fill=color, outline="white", width=2)
            self.canvas.create_text(x + 14, y - 12, text=label, fill=color,
                                    anchor="w", font=("TkDefaultFont", 10, "bold"))

    def _press(self, event):
        distances = []
        for index, point in enumerate(self.corners):
            x, y = self._point_pixels(point)
            distances.append(((event.x - x) ** 2 + (event.y - y) ** 2, index))
        distance, index = min(distances)
        self.drag_index = index if distance <= 28 ** 2 else None

    def _drag(self, event):
        if self.drag_index is None:
            return
        self.corners[self.drag_index] = [
            min(1.0, max(0.0, event.x / self.shown_width)),
            min(1.0, max(0.0, event.y / self.shown_height)),
        ]
        self._redraw()

    def _apply(self):
        try:
            corners = validate_normalized_corners(self.corners)
            registered, _homography = warp_birth_station_capture(self.original, corners)
        except ValueError as exc:
            messagebox.showerror("Invalid document corners", str(exc))
            return
        preview = tk.Toplevel(self.root)
        preview.title("Perspective-corrected PSA canvas preview")
        photo = _photo(registered, (900, 760))
        label = ttk.Label(preview, image=photo)
        label.image = photo
        label.pack(fill="both", expand=True, padx=8, pady=8)
        actions = ttk.Frame(preview, padding=8)
        actions.pack(fill="x")
        ttk.Button(actions, text="Adjust corners", command=preview.destroy).pack(side="left")
        ttk.Button(
            actions,
            text="Use this warp and align nine cells",
            command=lambda: (preview.destroy(), self._continue_to_rows(registered, corners)),
        ).pack(side="right")

    def _continue_to_rows(self, registered, corners):
        for widget in self.root.winfo_children():
            widget.destroy()
        BirthCalibrationApp(
            self.root, self.original, registered,
            initial_config=self.initial_config,
            calibration_status=self.calibration_status,
            registration_mode="manual_station_quad",
            normalized_corners=corners,
        )


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
    def __init__(
        self,
        root: tk.Tk,
        original: np.ndarray,
        registered: np.ndarray,
        *,
        initial_config: PSABirthRowCropperConfig | None = None,
        calibration_status: str = "repository_default",
        registration_mode: str = "strict_grid",
        normalized_corners=None,
    ):
        self.root = root
        self.original = original
        self.registered = registered
        self.config = initial_config or PSABirthRowCropperConfig()
        self.calibration_status = calibration_status
        self.registration_mode = registration_mode
        self.normalized_corners = validate_normalized_corners(normalized_corners)
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
        self.verified_cells: set[tuple[int, str]] = set()
        self.images: list[tk.PhotoImage] = []
        self._build()
        self._update_status()
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
        self.status_label = ttk.Label(
            toolbar,
            text=(
                f"Calibration: {self.calibration_status} | "
                f"Registration: {self.registration_mode}"
            ),
        )
        self.status_label.pack(side="left", padx=12)

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
        self.verified_cells.clear()
        self._update_status()
        self._redraw()

    def _update_status(self) -> None:
        self.status_label.configure(
            text=(
                f"Calibration: {self.calibration_status} | "
                f"Registration: {self.registration_mode} | "
                f"Exact cells inspected: {len(self.verified_cells)}/9"
            )
        )

    def _current_config(self) -> PSABirthRowCropperConfig:
        return PSABirthRowCropperConfig(
            row_geometries=tuple(
                (
                    row["field_name"],
                    int(row["left"]),
                    int(row["first_right"]),
                    int(row["middle_right"]),
                    int(row["right"]),
                    int(row["top"]),
                    int(row["bottom"]),
                )
                for row in self.rows
            ),
            allow_calibrated_topology_fallback=False,
        )

    def _cell(self, row_index: int, component: str) -> np.ndarray:
        row = self.rows[row_index]
        strict_config = self._current_config()
        topology = validate_psa_birth_name_topology(
            self.registered,
            config=strict_config,
        )
        if topology.success and topology.data is not None:
            exact = crop_psa_birth_name_rows(
                self.registered,
                config=strict_config,
                topology=topology.data,
            )
            key = f"{row['field_name']}.{component}_name"
            if exact.success and exact.data is not None and key in exact.data.crops:
                return exact.data.crops[key].copy()
        boundaries = [row["left"], row["first_right"], row["middle_right"], row["right"]]
        column = COMPONENTS.index(component)
        return self.registered[
            row["top"]:row["bottom"],
            boundaries[column]:boundaries[column + 1],
        ].copy()

    def _select(self, row_index: int, component: str) -> None:
        self.selected = (row_index, component)
        self.verified_cells.add((row_index, component))
        self._update_status()
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
            if len(self.verified_cells) != 9:
                raise ValueError(
                    "Inspect First, Middle, and Last for Items 1, 6, and 13 "
                    "after the final boundary adjustment before saving."
                )
            strict_config = self._current_config()
            topology = validate_psa_birth_name_topology(
                self.registered,
                config=strict_config,
            )
            if not topology.success or topology.data is None:
                raise ValueError(
                    "Items 1, 6, and 13 are not aligned to complete printed "
                    "cell borders. Adjust the colored boundaries before saving."
                )
            exact = crop_psa_birth_name_rows(
                self.registered,
                config=strict_config,
                topology=topology.data,
            )
            if (
                not exact.success
                or exact.data is None
                or len(exact.data.crops) != 9
                or any(image.size == 0 for image in exact.data.crops.values())
            ):
                raise ValueError(
                    "Calibration must produce exactly nine non-empty runtime cells."
                )
            if not messagebox.askyesno(
                "Confirm PSA row identity",
                "I verified that the three colored rows are exactly Item 1, "
                "Item 6, and Item 13, and that all nine previews contain only "
                "their printed First/Middle/Last cells.",
            ):
                return
            path = save_birth_station_calibration(
                self.rows,
                normalized_corners=self.normalized_corners,
                source_shape=self.original.shape,
                registration_mode=self.registration_mode,
            )
        except Exception as exc:
            messagebox.showerror("Invalid calibration", str(exc))
            return
        self.calibration_status = "loaded"
        self._update_status()
        messagebox.showinfo("Calibration saved", f"Saved locally to:\n{path}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, help="Latest Pi-local Birth capture")
    args = parser.parse_args()
    original = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if original is None:
        raise SystemExit(f"Unable to read {args.image}")
    calibration_config, calibration_metadata = load_birth_station_calibration()
    try:
        initial_config = PSABirthRowCropperConfig(**calibration_config)
    except (TypeError, ValueError):
        initial_config = PSABirthRowCropperConfig()
    saved_corners = calibration_metadata.get("normalized_corners")
    registration_mode = "strict_grid"
    registration = register_psa_birth_form(original)
    if not registration.success:
        registration = register_psa_birth_form(
            original,
            config=BIRTH_RELAXED_REGISTRATION_CONFIG,
        )
        registration_mode = "relaxed_validated_grid"
    if not registration.success:
        registration = register_psa_birth_form_grid_envelope(original)
        registration_mode = "validated_grid_envelope"
    root = tk.Tk()
    if not registration.success or registration.data is None:
        ManualCornerApp(
            root,
            original,
            initial_corners=saved_corners,
            initial_config=initial_config,
            calibration_status=str(calibration_metadata.get("status") or "unknown"),
        )
        root.mainloop()
        return 0
    try:
        automatic_corners = normalized_corners_from_homography(
            registration.data.transformation_metadata.homography,
            original.shape,
        )
    except (ValueError, TypeError, np.linalg.LinAlgError):
        automatic_corners = saved_corners
    if automatic_corners is None:
        ManualCornerApp(
            root,
            original,
            initial_config=initial_config,
            calibration_status=str(calibration_metadata.get("status") or "unknown"),
        )
        root.mainloop()
        return 0
    BirthCalibrationApp(
        root,
        original,
        registration.data.registered_image,
        initial_config=initial_config,
        calibration_status=str(calibration_metadata.get("status") or "unknown"),
        registration_mode=registration_mode,
        normalized_corners=automatic_corners,
    )
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
