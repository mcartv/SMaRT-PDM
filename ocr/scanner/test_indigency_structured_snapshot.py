from __future__ import annotations

import ast
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict

from document_contracts import (
    build_indigency_extracted_fields_from_result,
)


OCR_DIR = Path(__file__).resolve().parent
WORKER_SOURCE = (OCR_DIR / "job_worker.py").read_text(
    encoding="utf-8"
)


def load_snapshot_builder():
    tree = ast.parse(WORKER_SOURCE)
    selected = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name
        in {
            "_normalize_indigency_snapshot_value",
            "_build_indigency_structured_raw_text",
        }
    ]
    namespace = {"Any": Any, "Dict": Dict}
    module = ast.Module(body=selected, type_ignores=[])
    ast.fix_missing_locations(module)
    exec(compile(module, "snapshot_helpers", "exec"), namespace)
    return namespace["_build_indigency_structured_raw_text"]


build_snapshot = load_snapshot_builder()


class IndigencyStructuredSnapshotTest(unittest.TestCase):
    def test_snapshot_uses_only_successful_ocr_values(self):
        fields = tuple(
            SimpleNamespace(
                name=name,
                raw_text=value,
                success=success,
                issue_codes=(),
                detection_variant="grayscale",
                anchor="synthetic anchor",
                normalized_bounds=(0.1, 0.2, 0.3, 0.1),
            )
            for name, value, success in (
                (
                    "certificate_subject_name",
                    "OCR SUBJECT NAME",
                    True,
                ),
                ("residency_address", "12 SAMPLE STREET MARILAO BULACAN", True),
                ("issue_date", "24th day of March", True),
                ("issuing_barangay", "OCR BARANGAY", True),
            )
        )
        result = SimpleNamespace(
            data=SimpleNamespace(
                fields=fields,
                detection_variant="grayscale",
            )
        )
        payload = build_indigency_extracted_fields_from_result(
            "WHOLE PAGE PRINTED TEXT",
            result,
        )
        snapshot = build_snapshot(payload)

        self.assertEqual(
            snapshot.splitlines(),
            [
                "Certificate Subject Name: OCR SUBJECT NAME",
                "Full Address: 12 SAMPLE STREET MARILAO BULACAN",
            ],
        )
        self.assertEqual(len(snapshot.splitlines()), 2)

        for field in payload["fields"].values():
            value = str(field.get("raw_text") or "").strip()
            if field.get("success") and value:
                self.assertIn(value, snapshot)

        self.assertNotIn("WHOLE PAGE PRINTED TEXT", snapshot)

    def test_failed_field_is_not_fabricated(self):
        payload = {
            "fields": {
                "certificate_subject_name": {
                    "raw_text": "OCR SUBJECT",
                    "success": True,
                },
                "residency_address": {
                    "raw_text": "12 SAMPLE STREET MARILAO BULACAN",
                    "success": True,
                },
                "issue_date": {
                    "raw_text": "",
                    "success": False,
                },
                "issuing_barangay": {
                    "raw_text": "OCR BARANGAY",
                    "success": True,
                },
            }
        }
        snapshot = build_snapshot(payload)

        self.assertIn("OCR SUBJECT", snapshot)
        self.assertNotIn("OCR BARANGAY", snapshot)
        self.assertNotIn("Not extracted", snapshot)
        self.assertNotIn("Issue Date:", snapshot)

    def test_fixed_private_reference_values_are_absent(self):
        combined = "\\n".join(
            (
                (OCR_DIR / "document_contracts.py").read_text(
                    encoding="utf-8"
                ),
                WORKER_SOURCE,
            )
        ).upper()

        for token in (
            "VENICE",
            "PELIMA",
            "ROWENA",
            "FELONCO",
        ):
            self.assertNotIn(token, combined)

    def test_shadow_package_is_removed(self):
        self.assertFalse(
            (OCR_DIR / "document_contracts" / "__init__.py").exists()
        )


if __name__ == "__main__":
    unittest.main()
