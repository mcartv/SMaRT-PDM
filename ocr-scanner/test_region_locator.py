import ast
from pathlib import Path
import unittest

from extraction.geometry import NormalizedBounds
from extraction.models import AnchorResult
from extraction.region_locator import (
    BIRTH_REGION_FALLBACKS,
    RegionLocatorConfig,
    locate_birth_regions,
)


DOCUMENT = NormalizedBounds(0.0, 0.0, 1.0, 1.0)


def anchor(name, x=0.10, y=0.10, confidence=0.90):
    return AnchorResult(
        name=name,
        bounds=NormalizedBounds(x, y, 0.10, 0.02),
        confidence=confidence,
        success=True,
    )


def all_anchors():
    return [
        anchor("child_name", y=0.195),
        anchor("mother_maiden_name", y=0.345),
        anchor("father_name", y=0.475),
    ]


class RegionLocatorTest(unittest.TestCase):
    def test_default_fallback_bounds_are_valid(self):
        self.assertEqual(set(BIRTH_REGION_FALLBACKS), {"child_name", "mother_maiden_name", "father_name"})
        for bounds in BIRTH_REGION_FALLBACKS.values():
            self.assertIsInstance(bounds, NormalizedBounds)

    def test_anchor_relative_success_for_all_fields(self):
        result = locate_birth_regions(all_anchors(), DOCUMENT)

        self.assertTrue(result.success)
        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.data), 3)
        self.assertTrue(all(region.preprocessing_variant == "anchor_relative" for region in result.data))
        self.assertTrue(all(region.ocr_attempts == 0 for region in result.data))

    def test_missing_anchor_uses_fallback(self):
        result = locate_birth_regions(all_anchors()[1:], DOCUMENT)

        child = next(region for region in result.data if region.name == "child_name")
        self.assertEqual(child.preprocessing_variant, "normalized_fallback")
        self.assertEqual(child.confidence, 0.40)
        self.assertIn("ANCHOR_MISSING", self.issue_codes(result, "child_name"))
        self.assertIn("FALLBACK_REGION_USED", self.issue_codes(result, "child_name"))

    def test_low_confidence_anchor_uses_fallback(self):
        anchors = all_anchors()
        anchors[1] = anchor("mother_maiden_name", y=0.345, confidence=0.64)

        result = locate_birth_regions(anchors, DOCUMENT)

        mother = next(region for region in result.data if region.name == "mother_maiden_name")
        self.assertEqual(mother.preprocessing_variant, "normalized_fallback")
        self.assertIn("ANCHOR_LOW_CONFIDENCE", self.issue_codes(result, "mother_maiden_name"))

    def test_duplicate_anchor_conflict_uses_fallback(self):
        anchors = all_anchors() + [anchor("father_name", x=0.20, y=0.475)]

        result = locate_birth_regions(anchors, DOCUMENT)

        father = next(region for region in result.data if region.name == "father_name")
        self.assertEqual(father.preprocessing_variant, "normalized_fallback")
        self.assertIn("ANCHOR_CONFLICT", self.issue_codes(result, "father_name"))

    def test_out_of_bounds_anchor_uses_fallback(self):
        anchors = all_anchors()
        anchors[0] = anchor("child_name", x=0.70, y=0.195)

        result = locate_birth_regions(anchors, DOCUMENT)

        child = next(region for region in result.data if region.name == "child_name")
        self.assertEqual(child.preprocessing_variant, "normalized_fallback")
        self.assertIn("REGION_OUT_OF_BOUNDS", self.issue_codes(result, "child_name"))

    def test_configuration_override_behavior(self):
        custom = {"x": 0.30, "y": 0.20, "width": 0.20, "height": 0.03}

        result = locate_birth_regions([], DOCUMENT, {"fallback_confidence": 0.25, "fallbacks": {"child_name": custom}})

        child = next(region for region in result.data if region.name == "child_name")
        self.assertEqual(child.bounds, NormalizedBounds.from_dict(custom))
        self.assertEqual(child.confidence, 0.25)

    def test_invalid_override_is_rejected(self):
        with self.assertRaises(ValueError):
            locate_birth_regions([], DOCUMENT, {"confidence_threshold": float("nan")})

        with self.assertRaises(ValueError):
            locate_birth_regions([], DOCUMENT, {"fallbacks": {"child_name": {"x": 0.9, "y": 0.2, "width": 0.2, "height": 0.1}}})

    def test_partial_review_state_remains_successful(self):
        result = locate_birth_regions(all_anchors()[1:], DOCUMENT)

        self.assertTrue(result.success)
        self.assertEqual(result.status, "review_required")
        self.assertEqual(len(result.data), 3)

    def test_failure_when_anchor_and_fallback_are_unavailable(self):
        result = locate_birth_regions([], DOCUMENT, {"fallbacks": {"child_name": None}})

        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertEqual(len(result.data), 2)
        self.assertIn("REGION_GEOMETRY_INVALID", self.issue_codes(result, "child_name"))

    def test_invalid_document_bounds_fail_safely(self):
        result = locate_birth_regions([], None)

        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed")
        self.assertEqual(result.issues[0]["code"], "DOCUMENT_BOUNDS_INVALID")

    def test_input_anchors_are_not_mutated(self):
        anchors = all_anchors()
        before = [item.to_dict() for item in anchors]

        locate_birth_regions(anchors, DOCUMENT)

        self.assertEqual([item.to_dict() for item in anchors], before)

    def test_calls_cannot_mutate_defaults_or_later_results(self):
        first = locate_birth_regions([], DOCUMENT)
        first.data[0].bounds = NormalizedBounds(0.0, 0.0, 0.1, 0.1)
        first.issues.append({"code": "CHANGED"})

        second = locate_birth_regions([], DOCUMENT)

        self.assertEqual(second.data[0].bounds, BIRTH_REGION_FALLBACKS["child_name"])
        self.assertNotIn("CHANGED", {issue["code"] for issue in second.issues})

    def test_module_has_no_forbidden_runtime_imports(self):
        source = Path("extraction/region_locator.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        imported_roots = {
            alias.name.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        }
        imported_roots.update(
            (node.module or "").split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.level == 0
        )
        self.assertTrue(imported_roots.isdisjoint({"ocr", "camera", "job_worker", "api", "requests", "supabase"}))

    @staticmethod
    def issue_codes(result, field_name):
        return {issue["code"] for issue in result.issues if issue.get("field") == field_name}


if __name__ == "__main__":
    unittest.main()
