import unittest

from extraction.geometry import NormalizedBounds
from extraction.models import (
    AnchorResult,
    BirthExtractionResult,
    FieldCandidate,
    NormalizedImageMetadata,
    RegionResult,
    ReviewReason,
    ValidationIssue,
)
from extraction.stage_result import StageResult


class ExtractionModelsTest(unittest.TestCase):
    def test_defaults_and_null_contract_payload(self):
        result = BirthExtractionResult(document_key="certificate_of_live_birth")

        self.assertEqual(result.overall_status, "pending")
        self.assertEqual(result.stage_statuses["normalization"], "not_started")
        self.assertIsNone(result.final_contract_payload)
        self.assertEqual(result.field_candidates, [])
        self.assertEqual(result.validation_issues, [])
        self.assertEqual(result.review_reasons, [])
        self.assertEqual(result.metrics, {})

    def test_invalid_bounds_rejected(self):
        with self.assertRaises(ValueError):
            NormalizedBounds(x=1.2, y=0.1, width=0.5, height=0.1)

        with self.assertRaises(ValueError):
            NormalizedBounds(x=0.8, y=0.1, width=0.3, height=0.1)

    def test_bounds_reject_non_finite_boolean_and_non_numeric_values(self):
        invalid_values = [float("nan"), float("inf"), float("-inf"), True, False, "0.1"]
        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    NormalizedBounds(x=value, y=0.1, width=0.2, height=0.1)

    def test_bounds_accept_valid_integer_and_float_values(self):
        bounds = NormalizedBounds(x=0, y=0.25, width=1, height=0.75)
        self.assertEqual(bounds.to_dict(), {"x": 0.0, "y": 0.25, "width": 1.0, "height": 0.75})

    def test_invalid_state_transition_rejected(self):
        result = BirthExtractionResult(document_key="certificate_of_live_birth")
        with self.assertRaises(ValueError):
            result.set_overall_status("validated")

    def test_metric_validation(self):
        ok = BirthExtractionResult(
            document_key="certificate_of_live_birth",
            metrics={"ocr_ms": 12.5, "retry_count": 1, "anchor_found": True, "retrying": False},
        )
        self.assertEqual(ok.metrics["ocr_ms"], 12.5)
        self.assertIs(ok.metrics["anchor_found"], True)
        self.assertIs(ok.metrics["retrying"], False)

        invalid_values = [float("nan"), float("inf"), float("-inf"), "fast", [], {}, None]
        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    BirthExtractionResult(
                        document_key="certificate_of_live_birth",
                        metrics={"ocr_ms": value},
                    )

    def test_final_contract_payload_is_deeply_isolated(self):
        source = {"child_name": {"first_name": "Original"}}
        result = BirthExtractionResult(
            document_key="certificate_of_live_birth",
            final_contract_payload=source,
        )

        source["child_name"]["first_name"] = "Changed source"
        self.assertEqual(result.final_contract_payload["child_name"]["first_name"], "Original")

        serialized = result.to_dict()
        serialized["final_contract_payload"]["child_name"]["first_name"] = "Changed serialization"
        self.assertEqual(result.final_contract_payload["child_name"]["first_name"], "Original")

        payload = result.to_dict()
        reconstructed = BirthExtractionResult.from_dict(payload)
        reconstructed.final_contract_payload["child_name"]["first_name"] = "Changed model"
        self.assertEqual(payload["final_contract_payload"]["child_name"]["first_name"], "Original")

        other = BirthExtractionResult.from_dict(payload)
        self.assertEqual(other.final_contract_payload["child_name"]["first_name"], "Original")

    def test_issue_codes_and_review_codes(self):
        issue = ValidationIssue(
            code="MOTHER_NAME_LOW_CONFIDENCE",
            severity="warning",
            stage="validation",
            field="mother_maiden_name",
            message="Mother name confidence below threshold",
        )
        reason = ReviewReason(code="PARTIAL_EXTRACTION", message="Manual review required")
        result = BirthExtractionResult(
            document_key="certificate_of_live_birth",
            validation_issues=[issue],
            review_reasons=[reason],
        )

        self.assertEqual(result.validation_issues[0].code, "MOTHER_NAME_LOW_CONFIDENCE")
        self.assertEqual(result.review_reasons[0].code, "PARTIAL_EXTRACTION")

    def test_include_sensitive_redaction_and_preservation(self):
        result = BirthExtractionResult(
            document_key="certificate_of_live_birth",
            field_candidates=[
                FieldCandidate(
                    field_name="child_name",
                    value={"first_name": "Venice", "middle_name": "Eve", "last_name": "Pelima"},
                    confidence=0.91,
                    source_region="child_name",
                )
            ],
        )

        redacted = result.to_dict()
        self.assertEqual(redacted["field_candidates"], [])

        sensitive = result.to_dict(include_sensitive=True)
        self.assertEqual(len(sensitive["field_candidates"]), 1)
        self.assertEqual(sensitive["field_candidates"][0]["value"]["first_name"], "Venice")

    def test_round_trip_serialization(self):
        result = BirthExtractionResult(
            document_key="certificate_of_live_birth",
            overall_status="review_required",
            stage_statuses={
                "normalization": "success",
                "anchor_detection": "partial",
                "region_extraction": "success",
                "ocr": "partial",
                "validation": "review_required",
                "contract_building": "not_started",
            },
            normalized_image=NormalizedImageMetadata(
                original_width=1200,
                original_height=1600,
                normalized_width=1000,
                normalized_height=1400,
                skew_correction_applied=True,
                perspective_correction_applied=False,
            ),
            anchors=[AnchorResult("child_name", NormalizedBounds(0.1, 0.2, 0.3, 0.1), 0.88, True)],
            regions=[RegionResult("child_name", NormalizedBounds(0.1, 0.2, 0.3, 0.1), True, confidence=0.87)],
            field_candidates=[
                FieldCandidate(
                    field_name="child_name",
                    value={"first_name": "Venice", "middle_name": "Eve", "last_name": "Pelima"},
                    confidence=0.91,
                    source_region="child_name",
                )
            ],
            field_confidence={"child_name": 0.91},
            validation_issues=[
                ValidationIssue(
                    code="CHILD_NAME_LOW_CONFIDENCE",
                    severity="warning",
                    stage="validation",
                    field="child_name",
                    message="Confidence below threshold",
                )
            ],
            review_reasons=[ReviewReason(code="PARTIAL_EXTRACTION", message="Manual review required")],
            metrics={"ocr_ms": 12, "retry_count": 1, "anchor_found": True},
            final_contract_payload=None,
        )

        payload = result.to_dict(include_sensitive=True)
        reconstructed = BirthExtractionResult.from_dict(payload)
        self.assertEqual(reconstructed.to_dict(include_sensitive=True), payload)

    def test_mutation_isolation(self):
        first = BirthExtractionResult(document_key="certificate_of_live_birth")
        first.anchors.append(AnchorResult("child_name", NormalizedBounds(0.1, 0.2, 0.3, 0.1), 0.9, True))
        first.regions.append(RegionResult("child_name", NormalizedBounds(0.1, 0.2, 0.3, 0.1), True))
        first.field_candidates.append(
            FieldCandidate(
                field_name="child_name",
                value={"first_name": "A", "middle_name": "B", "last_name": "C"},
                confidence=0.9,
            )
        )
        first.validation_issues.append(
            ValidationIssue(
                code="CHILD_NAME_LOW_CONFIDENCE",
                severity="warning",
                stage="validation",
                field="child_name",
            )
        )
        first.review_reasons.append(ReviewReason(code="PARTIAL_EXTRACTION"))
        first.metrics["ocr_ms"] = 10
        first.final_contract_payload = {"document_type": "birth_certificate"}

        second = BirthExtractionResult(document_key="certificate_of_live_birth")
        self.assertEqual(second.anchors, [])
        self.assertEqual(second.regions, [])
        self.assertEqual(second.field_candidates, [])
        self.assertEqual(second.validation_issues, [])
        self.assertEqual(second.review_reasons, [])
        self.assertEqual(second.metrics, {})
        self.assertIsNone(second.final_contract_payload)

    def test_stage_result_reusable(self):
        stage = StageResult(stage="ocr", success=False, status="failed", data={"value": 1})
        payload = stage.to_dict()
        reconstructed = StageResult.from_dict(payload)
        self.assertEqual(reconstructed.to_dict(), payload)


if __name__ == "__main__":
    unittest.main()
