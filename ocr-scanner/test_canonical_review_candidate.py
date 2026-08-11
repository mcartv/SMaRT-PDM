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

    def test_successful_indigency_payload_keeps_fields_and_resolves_template(self):
        fields = {
            "certificate_subject_name": {"raw_text": "JUAN DELA CRUZ", "success": True},
            "residency_address": {
                "raw_text": "12 DE VERA COMPOUND, LIAS, MARILAO, BULACAN",
                "success": True,
            },
        }
        candidate = candidate_from_worker_payload(
            {"request_id": "request", "document_key": "indigency"},
            {
                "raw_text": "structured raw text",
                "document_type": "certificate_of_indigency",
                "extracted_fields": {
                    "document_type": "certificate_of_indigency",
                    "fields": fields,
                },
                "source_payload": {"registration_status": "matched"},
            },
        ).serialize()

        self.assertEqual(candidate["document_key"], "certificate_of_indigency")
        self.assertEqual(candidate["template_id"], "indigency_v1")
        self.assertEqual(candidate["fields"], fields)
        self.assertEqual(candidate["validation_issues"], [])

    def test_payload_document_type_recovers_missing_request_document_key(self):
        candidate = candidate_from_worker_payload(
            {"request_id": "request"},
            {
                "document_type": "certificate_of_indigency",
                "extracted_fields": {
                    "document_type": "certificate_of_indigency",
                    "fields": {"certificate_subject_name": {"raw_text": "NAME"}},
                },
                "source_payload": {"registration_status": "matched"},
            },
        ).serialize()

        self.assertEqual(candidate["document_key"], "certificate_of_indigency")
        self.assertEqual(candidate["template_id"], "indigency_v1")
        self.assertTrue(candidate["fields"])


if __name__ == "__main__":
    unittest.main()
