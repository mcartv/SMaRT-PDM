from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from birth_station_calibration import (
    fit_capture_to_display,
    load_birth_station_calibration,
    save_birth_station_calibration,
    validate_normalized_corners,
    warp_birth_station_capture,
)
from extraction.psa_birth_row_cropper import PSABirthRowCropperConfig


class BirthStationCalibrationTest(unittest.TestCase):
    corners = ((0.1, 0.1), (0.9, 0.1), (0.9, 0.9), (0.1, 0.9))
    def rows(self):
        return [
            {
                "field_name": row[0],
                "left": row[1],
                "first_right": row[2],
                "middle_right": row[3],
                "right": row[4],
                "top": row[5],
                "bottom": row[6],
            }
            for row in PSABirthRowCropperConfig().row_geometries
        ]

    def test_round_trip_uses_versioned_local_geometry(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "birth.json"
            save_birth_station_calibration(
                self.rows(), path,
                normalized_corners=self.corners,
                source_shape=(1000, 1600, 3),
            )
            config, metadata = load_birth_station_calibration(path)
        self.assertEqual(metadata["status"], "loaded")
        self.assertEqual(
            config["row_geometries"],
            PSABirthRowCropperConfig().row_geometries,
        )
        self.assertEqual(metadata["version"], 2)
        self.assertEqual(metadata["source_size"], {"width": 1600, "height": 1000})

    def test_manual_warp_produces_fixed_registered_canvas(self):
        source = np.full((1000, 1600, 3), 255, dtype=np.uint8)
        registered, homography = warp_birth_station_capture(source, self.corners)
        self.assertEqual(registered.shape[:2], (1375, 1400))
        self.assertEqual(len(homography), 9)

    def test_small_pi_display_keeps_the_complete_capture_visible(self):
        width, height, scale = fit_capture_to_display(
            (2592, 4608, 3), 800, 480,
        )
        self.assertLessEqual(width + 32, 800)
        self.assertLessEqual(height + 96, 480)
        self.assertAlmostEqual(width / height, 4608 / 2592, places=2)
        self.assertGreater(scale, 0)

    def test_crossed_and_undersized_corners_fail_safely(self):
        with self.assertRaises(ValueError):
            validate_normalized_corners(((0.1, 0.1), (0.9, 0.9), (0.9, 0.1), (0.1, 0.9)))
        with self.assertRaises(ValueError):
            validate_normalized_corners(((0.1, 0.1), (0.2, 0.1), (0.2, 0.2), (0.1, 0.2)))

    def test_invalid_artifact_never_reaches_cropper(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "birth.json"
            path.write_text(json.dumps({"version": 999, "rows": []}), encoding="utf-8")
            config, metadata = load_birth_station_calibration(path)
        self.assertEqual(config, {})
        self.assertEqual(metadata["status"], "invalid")


if __name__ == "__main__":
    unittest.main()
