from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from birth_station_calibration import (
    load_birth_station_calibration,
    save_birth_station_calibration,
)
from extraction.psa_birth_row_cropper import PSABirthRowCropperConfig


class BirthStationCalibrationTest(unittest.TestCase):
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
            save_birth_station_calibration(self.rows(), path)
            config, metadata = load_birth_station_calibration(path)
        self.assertEqual(metadata["status"], "loaded")
        self.assertEqual(
            config["row_geometries"],
            PSABirthRowCropperConfig().row_geometries,
        )

    def test_invalid_artifact_never_reaches_cropper(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "birth.json"
            path.write_text(json.dumps({"version": 999, "rows": []}), encoding="utf-8")
            config, metadata = load_birth_station_calibration(path)
        self.assertEqual(config, {})
        self.assertEqual(metadata["status"], "invalid")


if __name__ == "__main__":
    unittest.main()
