import unittest

from models.ocr_result import ReviewCandidate
from pipeline.result_serializer import candidate_from_worker_payload


class CanonicalReviewCandidateTest(unittest.TestCase):
    def test_serialization_always_stops_at_review_required(self):
        candidate = ReviewCandidate(
            request_id="request",
            document_key="student_grade_forms",
            template_id="grade_form_v1",
            raw_text="text",
            fields={},
            field_confidence={},
            validation_issues=[],
            registration_status="matched",
        ).serialize()
        self.assertEqual(candidate["status"], "review_required")
        self.assertTrue(candidate["review_required"])

    def test_image_bearing_payload_is_rejected(self):
        with self.assertRaises(ValueError):
            ReviewCandidate(
                request_id="request",
                document_key="student_grade_forms",
                template_id="grade_form_v1",
                raw_text="",
                fields={"nested": {"capture_path": "/tmp/a.jpg"}},
                field_confidence={},
                validation_issues=[],
                registration_status="matched",
            ).serialize()

    def test_missing_registration_never_exposes_coordinate_fields(self):
        candidate = candidate_from_worker_payload(
            {"request_id": "request", "document_key": "student_grade_forms"},
            {
                "raw_text": "safe raw text",
                "extracted_fields": {"fields": {"student_number": "guessed"}},
                "source_payload": {},
            },
        ).serialize()
        self.assertEqual(candidate["processing"]["registration_status"], "mismatch")
        self.assertEqual(candidate["fields"], {})
        self.assertTrue(candidate["validation_issues"])


if __name__ == "__main__":
    unittest.main()
