import unittest

from extraction.anchor_locator import locate_birth_certificate_anchors
from extraction.geometry import NormalizedBounds


class AnchorLocatorTest(unittest.TestCase):
    def setUp(self):
        self.bounds = NormalizedBounds(x=0.1, y=0.2, width=0.3, height=0.1)

    def locate(self, text, bounds=None):
        return locate_birth_certificate_anchors(
            [{"text": text, "bounds": self.bounds if bounds is None else bounds}]
        )

    def test_exact_child_name_label(self):
        anchors = self.locate("Child Name")

        self.assertEqual([anchor.name for anchor in anchors], ["child_name"])

    def test_case_insensitive_match(self):
        anchors = self.locate("cHiLd NaMe")

        self.assertEqual(anchors[0].name, "child_name")

    def test_trailing_colon_and_punctuation_are_ignored(self):
        anchors = self.locate("Child Name:...")

        self.assertEqual(anchors[0].name, "child_name")

    def test_name_of_child_alias(self):
        anchors = self.locate("Name of Child")

        self.assertEqual(anchors[0].name, "child_name")

    def test_mother_maiden_name_aliases(self):
        for label in ("Mother Maiden Name", "Mother's Maiden Name", "Mother\u2019s Maiden Name"):
            with self.subTest(label=label):
                self.assertEqual(self.locate(label)[0].name, "mother_maiden_name")

    def test_father_name_aliases(self):
        for label in ("Father Name", "Father's Name", "Father\u2019s Name"):
            with self.subTest(label=label):
                self.assertEqual(self.locate(label)[0].name, "father_name")

    def test_unrelated_text_returns_no_anchors(self):
        self.assertEqual(self.locate("Certificate of Live Birth"), [])

    def test_missing_or_invalid_bounds_are_rejected(self):
        with self.assertRaises(ValueError):
            locate_birth_certificate_anchors([{"text": "Child Name"}])

        with self.assertRaises(ValueError):
            self.locate("Child Name", bounds="invalid")

        with self.assertRaises(ValueError):
            self.locate(
                "Child Name",
                bounds={"x": 0.9, "y": 0.2, "width": 0.2, "height": 0.1},
            )

    def test_returned_bounds_are_preserved(self):
        anchor = self.locate("Child Name")[0]

        self.assertIs(anchor.bounds, self.bounds)
        self.assertEqual(anchor.confidence, 1.0)
        self.assertTrue(anchor.success)

    def test_duplicate_labels_return_first_match(self):
        first_bounds = NormalizedBounds(0.1, 0.2, 0.3, 0.1)
        second_bounds = NormalizedBounds(0.2, 0.3, 0.3, 0.1)

        anchors = locate_birth_certificate_anchors(
            [
                {"text": "Child Name", "bounds": first_bounds},
                {"text": "Name of Child", "bounds": second_bounds},
            ]
        )

        self.assertEqual(len(anchors), 1)
        self.assertIs(anchors[0].bounds, first_bounds)
        self.assertEqual(anchors[0].match_text, "Child Name")


if __name__ == "__main__":
    unittest.main()
