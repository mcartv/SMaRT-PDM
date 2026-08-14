from __future__ import annotations

import unittest
from pathlib import Path


class BirthCalibrationGuiContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (
            Path(__file__).with_name("birth_calibration_gui.py")
            .read_text(encoding="utf-8")
        )

    def test_enter_advances_preview_and_saves_second_stage(self):
        self.assertIn('self.root.bind("<Return>", self._preview_from_keyboard)', self.source)
        self.assertIn('preview.bind("<Return>", accept_from_keyboard)', self.source)
        self.assertIn('self.root.bind("<Return>", self._save_from_keyboard)', self.source)
        self.assertIn('SAVE CALIBRATION (Enter)', self.source)

    def test_preview_controls_are_rendered_before_the_image(self):
        apply_source = self.source.split("    def _apply(self):", 1)[1].split(
            "    def _continue_to_rows", 1
        )[0]
        self.assertLess(
            apply_source.index('actions.pack(fill="x")'),
            apply_source.index('label.pack(fill="both"'),
        )

    def test_manual_corner_copy_targets_complete_printed_grid(self):
        self.assertIn("complete printed grid (Items 1-13)", self.source)

    def test_save_does_not_require_nine_button_clicks(self):
        save_source = self.source.split("    def _save(self) -> None:", 1)[1].split(
            "\n\ndef main()", 1
        )[0]
        self.assertNotIn("len(self.verified_cells) != 9", save_source)
        self.assertIn("len(exact.data.crops) != 9", save_source)


if __name__ == "__main__":
    unittest.main()
