import json
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from birth_manual_review import (
    build_manual_field_texts,
    cleanup_expired_birth_review_archives,
    normalize_manual_fields,
    save_birth_review_archive,
)


class BirthManualReviewTest(unittest.TestCase):
    def test_normalizes_components_without_guessing_name_order(self):
        fields = normalize_manual_fields({
            "child_name": {
                "first_name": "  Juan  ",
                "middle_name": "Santos",
                "last_name": "Dela   Cruz",
            },
        })

        self.assertEqual(fields["child_name"]["first_name"], "Juan")
        self.assertEqual(fields["child_name"]["last_name"], "Dela Cruz")
        self.assertEqual(fields["mother_maiden_name"]["first_name"], "")

    def test_builds_existing_birth_field_contract_without_confidence(self):
        result = build_manual_field_texts({
            "father_name": {
                "first_name": "Pedro",
                "middle_name": "Reyes",
                "last_name": "Santos",
            },
        })

        father = result["father_name"]
        self.assertEqual(father["raw_text"], "Pedro Reyes Santos")
        self.assertEqual(father["components"]["last_name"], "Santos")
        self.assertIsNone(father["confidence"])
        self.assertEqual(father["section_status"], "present")

    def test_archive_contains_local_capture_crops_json_and_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "archive"
            capture = Path(directory) / "capture.jpg"
            image = np.full((80, 180, 3), 240, dtype=np.uint8)
            self.assertTrue(cv2.imwrite(str(capture), image))

            target = save_birth_review_archive(
                request_id="request-123",
                capture_path=str(capture),
                row_crops={
                    "child_name": image,
                    "mother_maiden_name": image,
                    "father_name": image,
                },
                fields={
                    "child_name": {
                        "first_name": "Juan",
                        "middle_name": "Santos",
                        "last_name": "Cruz",
                    },
                },
                root=root,
            )

            self.assertTrue((target / "capture.jpg").is_file())
            self.assertTrue((target / "child_name.png").is_file())
            self.assertTrue((target / "manual_entry.csv").is_file())
            payload = json.loads(
                (target / "manual_entry.json").read_text(encoding="utf-8")
            )
            self.assertEqual(payload["entry_source"], "pi_local_human_review")
            self.assertEqual(
                payload["fields"]["child_name"]["last_name"],
                "Cruz",
            )

    def test_expired_archive_cleanup_is_scoped_to_archive_children(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "archive"
            old = root / "old-request"
            current = root / "current-request"
            old.mkdir(parents=True)
            current.mkdir()
            old_timestamp = 1_000.0
            old.touch()
            import os
            os.utime(old, (old_timestamp, old_timestamp))

            removed = cleanup_expired_birth_review_archives(
                root,
                retention_days=1,
                now=old_timestamp + 2 * 86400,
            )

            self.assertEqual(removed, 1)
            self.assertFalse(old.exists())
            self.assertTrue(current.exists())


if __name__ == "__main__":
    unittest.main()
