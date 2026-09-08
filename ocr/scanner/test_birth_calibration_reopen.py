"""Keep saved name rows in the coordinate system in which they were aligned."""

import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

import birth_calibration_gui as gui
from birth_station_calibration import warp_birth_station_capture
from extraction.psa_birth_row_cropper import PSABirthRowCropperConfig


class BirthCalibrationReopenTest(unittest.TestCase):
    def setUp(self):
        self.image = np.zeros((1000, 1600, 3), dtype=np.uint8)
        self.image[200:500, 300:800] = 255
        self.corners = ((0.1, 0.1), (0.9, 0.12), (0.85, 0.9), (0.12, 0.85))
        self.rows = tuple(
            (*row[:5], row[5] + 10, row[6] + 10)
            for row in PSABirthRowCropperConfig().row_geometries
        )
        self.metadata = {
            "status": "loaded",
            "normalized_corners": self.corners,
            "source_size": {"width": 1600, "height": 1000},
        }

    def run_editor(self, registration=None):
        with (
            patch.object(sys, "argv", ["birth_calibration_gui.py", "capture.jpg"]),
            patch.object(gui.cv2, "imread", return_value=self.image),
            patch.object(gui, "load_birth_station_calibration",
                         return_value=({"row_geometries": self.rows}, self.metadata)),
            patch.object(gui.tk, "Tk"),
            patch.object(gui, "BirthCalibrationApp") as editor,
            patch.object(gui, "ManualCornerApp") as manual,
            patch.object(gui, "register_psa_birth_form", return_value=registration) as automatic,
            patch.object(gui, "normalized_corners_from_homography",
                         return_value=self.corners),
        ):
            self.assertEqual(gui.main(), 0)
            return editor, manual, automatic

    def test_reopen_preserves_saved_rows_and_exact_worker_canvas(self):
        expected, _ = warp_birth_station_capture(self.image, self.corners)
        editor, manual, automatic = self.run_editor()
        automatic.assert_not_called()
        manual.assert_not_called()
        np.testing.assert_array_equal(editor.call_args.args[2], expected)
        self.assertEqual(editor.call_args.kwargs["initial_config"].row_geometries, self.rows)
        self.assertEqual(editor.call_args.kwargs["normalized_corners"], self.corners)
        self.assertEqual(editor.call_args.kwargs["registration_mode"], "manual_station_quad")

    def test_new_capture_size_does_not_transplant_saved_rows(self):
        self.metadata["source_size"]["width"] = 2304
        automatic_image = np.zeros((1375, 1400, 3), dtype=np.uint8)
        registration = SimpleNamespace(success=True, data=SimpleNamespace(
            registered_image=automatic_image,
            transformation_metadata=SimpleNamespace(homography=np.eye(3)),
        ))
        editor, manual, automatic = self.run_editor(registration)
        automatic.assert_called_once()
        manual.assert_not_called()
        self.assertEqual(editor.call_args.kwargs["initial_config"].row_geometries,
                         PSABirthRowCropperConfig().row_geometries)
        self.assertEqual(editor.call_args.kwargs["calibration_status"], "recalibration_required")


if __name__ == "__main__":
    unittest.main()
