"""Pi-local human review for validated PSA Birth name-row crops."""

from __future__ import annotations

import csv
import base64
import json
import os
import re
import shutil
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

import cv2
import numpy as np


FIELD_LABELS = (
    ("child_name", "Child Name (Item 1)"),
    ("mother_maiden_name", "Mother's Maiden Name (Item 6)"),
    ("father_name", "Father's Name (Item 13)"),
)
COMPONENTS = ("first_name", "middle_name", "last_name")
COMPONENT_LABELS = ("First Name", "Middle Name", "Last Name")


@dataclass(frozen=True)
class BirthManualReviewResult:
    status: str
    fields: Mapping[str, Mapping[str, str]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.status not in {"submitted", "cancelled", "unavailable"}:
            raise ValueError("invalid Birth manual-review status")


def _safe_request_reference(value: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]", "-", str(value or ""))[:80]
    return safe or "unknown-request"


def _normalize_component(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_manual_fields(
    fields: Mapping[str, Mapping[str, Any]],
) -> dict[str, dict[str, str]]:
    return {
        field_name: {
            component: _normalize_component(
                (fields.get(field_name) or {}).get(component)
            )
            for component in COMPONENTS
        }
        for field_name, _label in FIELD_LABELS
    }


def build_manual_field_texts(
    fields: Mapping[str, Mapping[str, Any]],
) -> dict[str, dict[str, Any]]:
    normalized = normalize_manual_fields(fields)
    return {
        field_name: {
            "raw_text": " ".join(
                value
                for value in normalized[field_name].values()
                if value
            ),
            "components": dict(normalized[field_name]),
            "section_status": (
                "present"
                if any(normalized[field_name].values())
                else "blank"
            ),
            "confidence": None,
            "component_confidence": {
                component: None for component in COMPONENTS
            },
            "component_raw_text": dict(normalized[field_name]),
        }
        for field_name, _label in FIELD_LABELS
    }


def _archive_root() -> Path:
    configured = os.getenv("BIRTH_MANUAL_REVIEW_ARCHIVE_DIR", "").strip()
    if configured:
        return Path(configured).expanduser()
    return Path.home() / "smart-pdm-birth-review"


def cleanup_expired_birth_review_archives(
    root: Path,
    *,
    retention_days: int,
    now: float | None = None,
) -> int:
    if not root.is_dir():
        return 0
    cutoff = (time.time() if now is None else now) - retention_days * 86400
    removed = 0
    for child in root.iterdir():
        try:
            if child.is_dir() and child.stat().st_mtime < cutoff:
                shutil.rmtree(child)
                removed += 1
        except OSError:
            continue
    return removed


def save_birth_review_archive(
    *,
    request_id: str,
    capture_path: str,
    row_crops: Mapping[str, np.ndarray],
    fields: Mapping[str, Mapping[str, Any]],
    root: Path | None = None,
) -> Path:
    archive_root = root or _archive_root()
    archive_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        os.chmod(archive_root, 0o700)
    except OSError:
        pass

    directory = archive_root / _safe_request_reference(request_id)
    directory.mkdir(mode=0o700, parents=False, exist_ok=True)
    try:
        os.chmod(directory, 0o700)
    except OSError:
        pass

    source = Path(capture_path)
    if source.is_file():
        raw_target = directory / "capture.jpg"
        shutil.copy2(source, raw_target)
        try:
            os.chmod(raw_target, 0o600)
        except OSError:
            pass

    crop_names: dict[str, str] = {}
    for field_name, _label in FIELD_LABELS:
        crop = row_crops.get(field_name)
        if not isinstance(crop, np.ndarray) or crop.size == 0:
            continue
        target = directory / f"{field_name}.png"
        if cv2.imwrite(str(target), crop):
            crop_names[field_name] = target.name
            try:
                os.chmod(target, 0o600)
            except OSError:
                pass

    normalized = normalize_manual_fields(fields)
    recorded_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "request_id": request_id,
        "recorded_at": recorded_at,
        "capture_file": "capture.jpg" if (directory / "capture.jpg").is_file() else None,
        "crop_files": crop_names,
        "fields": normalized,
        "entry_source": "pi_local_human_review",
    }
    json_path = directory / "manual_entry.json"
    temporary_json = directory / "manual_entry.json.tmp"
    temporary_json.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temporary_json, json_path)

    csv_path = directory / "manual_entry.csv"
    temporary_csv = directory / "manual_entry.csv.tmp"
    with temporary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=(
                "request_id",
                "recorded_at",
                "field",
                *COMPONENTS,
            ),
        )
        writer.writeheader()
        for field_name, _label in FIELD_LABELS:
            writer.writerow({
                "request_id": request_id,
                "recorded_at": recorded_at,
                "field": field_name,
                **normalized[field_name],
            })
    os.replace(temporary_csv, csv_path)
    for path in (json_path, csv_path):
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    return directory


def _tkinter_review(
    *,
    row_crops: Mapping[str, np.ndarray],
    initial_fields: Mapping[str, Mapping[str, Any]],
    should_stop: Callable[[], bool] | None,
) -> BirthManualReviewResult:
    import tkinter as tk
    from tkinter import messagebox, ttk

    root = tk.Tk()
    root.title("SMaRT-PDM Birth Certificate Review")
    root.attributes("-fullscreen", True)
    root.configure(background="#f7f5f2")
    result: dict[str, Any] = {"status": "cancelled", "fields": {}}
    images: list[Any] = []
    entries: dict[str, dict[str, Any]] = {}

    heading = ttk.Label(
        root,
        text="BIRTH CERTIFICATE — VERIFY ITEMS 1, 6, AND 13",
        font=("Arial", 20, "bold"),
    )
    heading.pack(pady=(18, 4))
    ttk.Label(
        root,
        text="Compare each validated crop with the fields, then submit for admin confirmation.",
        font=("Arial", 12),
    ).pack(pady=(0, 14))

    content = ttk.Frame(root, padding=12)
    content.pack(fill="both", expand=True)
    for row_index, (field_name, label) in enumerate(FIELD_LABELS):
        frame = ttk.LabelFrame(content, text=label, padding=10)
        frame.grid(row=row_index, column=0, sticky="nsew", padx=8, pady=6)
        content.rowconfigure(row_index, weight=1)
        content.columnconfigure(0, weight=1)

        crop = row_crops.get(field_name)
        if isinstance(crop, np.ndarray) and crop.size:
            rgb = (
                cv2.cvtColor(crop, cv2.COLOR_GRAY2RGB)
                if crop.ndim == 2
                else cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            )
            height, width = rgb.shape[:2]
            scale = min(1.0, 950.0 / width, 180.0 / height)
            if scale < 1.0:
                rgb = cv2.resize(
                    rgb,
                    (max(1, int(width * scale)), max(1, int(height * scale))),
                    interpolation=cv2.INTER_AREA,
                )
            shown_height, shown_width = rgb.shape[:2]
            ppm = (
                f"P6\n{shown_width} {shown_height}\n255\n".encode("ascii")
                + rgb.tobytes()
            )
            photo = tk.PhotoImage(
                data=base64.b64encode(ppm).decode("ascii"),
                format="PPM",
            )
            images.append(photo)
            ttk.Label(frame, image=photo).grid(
                row=0,
                column=0,
                columnspan=3,
                sticky="w",
                pady=(0, 8),
            )

        entries[field_name] = {}
        for column, (component, component_label) in enumerate(
            zip(COMPONENTS, COMPONENT_LABELS)
        ):
            ttk.Label(frame, text=component_label).grid(
                row=1,
                column=column,
                sticky="w",
                padx=4,
            )
            entry = ttk.Entry(frame, font=("Arial", 14), width=28)
            entry.insert(
                0,
                _normalize_component(
                    (initial_fields.get(field_name) or {}).get(component)
                ),
            )
            entry.grid(row=2, column=column, sticky="ew", padx=4, pady=4)
            frame.columnconfigure(column, weight=1)
            entries[field_name][component] = entry

    def submit() -> None:
        fields = {
            field_name: {
                component: widget.get()
                for component, widget in component_entries.items()
            }
            for field_name, component_entries in entries.items()
        }
        normalized = normalize_manual_fields(fields)
        if not any(
            any(value for value in components.values())
            for components in normalized.values()
        ):
            messagebox.showerror(
                "Birth Certificate Review",
                "Enter at least one readable name before submitting.",
                parent=root,
            )
            return
        result["status"] = "submitted"
        result["fields"] = normalized
        root.destroy()

    def cancel() -> None:
        result["status"] = "cancelled"
        root.destroy()

    controls = ttk.Frame(root, padding=12)
    controls.pack(fill="x")
    ttk.Button(controls, text="Cancel", command=cancel).pack(side="left")
    ttk.Button(controls, text="Submit for Admin Review", command=submit).pack(
        side="right"
    )
    root.protocol("WM_DELETE_WINDOW", cancel)

    def poll_stop() -> None:
        if should_stop and should_stop():
            cancel()
            return
        root.after(250, poll_stop)

    root.after(250, poll_stop)
    root.mainloop()
    return BirthManualReviewResult(
        status=str(result["status"]),
        fields=result["fields"],
    )


def collect_birth_manual_review(
    *,
    request_id: str,
    capture_path: str,
    row_crops: Mapping[str, np.ndarray],
    initial_fields: Mapping[str, Mapping[str, Any]],
    should_stop: Callable[[], bool] | None = None,
) -> BirthManualReviewResult:
    enabled = os.getenv("BIRTH_MANUAL_REVIEW_ENABLED", "true").strip().lower()
    if enabled in {"0", "false", "no", "off"}:
        return BirthManualReviewResult("unavailable")
    if not (os.getenv("DISPLAY") or os.getenv("WAYLAND_DISPLAY")):
        return BirthManualReviewResult("unavailable")

    try:
        review = _tkinter_review(
            row_crops=row_crops,
            initial_fields=initial_fields,
            should_stop=should_stop,
        )
    except Exception:
        return BirthManualReviewResult("unavailable")
    if review.status != "submitted":
        return review

    retention_days = max(
        1,
        int(os.getenv("BIRTH_MANUAL_REVIEW_RETENTION_DAYS", "7")),
    )
    root = _archive_root()
    cleanup_expired_birth_review_archives(
        root,
        retention_days=retention_days,
    )
    try:
        save_birth_review_archive(
            request_id=request_id,
            capture_path=capture_path,
            row_crops=row_crops,
            fields=review.fields,
            root=root,
        )
    except OSError:
        # Manual data still proceeds to immutable candidate review. The worker
        # deliberately does not print names or filesystem paths.
        pass
    return review


__all__ = [
    "BirthManualReviewResult",
    "build_manual_field_texts",
    "cleanup_expired_birth_review_archives",
    "collect_birth_manual_review",
    "normalize_manual_fields",
    "save_birth_review_archive",
]
