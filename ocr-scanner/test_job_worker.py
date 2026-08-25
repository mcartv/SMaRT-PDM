import inspect
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

import numpy as np

import job_worker
from capture_session import CANCELLED, CAPTURED, FAILED, CaptureSessionResult


CAPTURE_PATH = "/tmp/shared-capture.jpg"


def _stage_result(status="success", success=True, data=None, issues=None, metrics=None):
    return SimpleNamespace(
        status=status,
        success=success,
        data=data,
        issues=list(issues or []),
        metrics=dict(metrics or {}),
    )


def _birth_registration_result(status="success"):
    registered_image = np.full((1375, 1400, 3), 240, dtype=np.uint8)
    transformation_metadata = SimpleNamespace(
        canonical_left_boundary=0.0,
        canonical_right_boundary=1.0,
        canonical_top_boundary=0.0,
        canonical_bottom_boundary=1.0,
        canonical_vertical_landmarks=(0.2, 0.5, 0.8),
        canonical_horizontal_landmarks=(0.1, 0.4, 0.7),
        maximum_canonical_edge_deviation=0.0,
    )
    return _stage_result(
        status=status,
        success=status != "failed",
        data=SimpleNamespace(
            registered_image=registered_image,
            transformation_metadata=transformation_metadata,
        ),
    )


def _birth_registration_context(status="success"):
    result = _birth_registration_result(status)
    return {
        "status": result.status,
        "issues": result.issues,
        "transformation_metadata": result.data.transformation_metadata,
    }


def _birth_crop_result(status="success"):
    names = ("child_name", "mother_maiden_name", "father_name")
    crops = {
        "child_name": np.full((193, 1400, 3), 10, dtype=np.uint8),
        "mother_maiden_name": np.full((117, 1400, 3), 20, dtype=np.uint8),
        "father_name": np.full((96, 1400, 3), 30, dtype=np.uint8),
    }
    regions = tuple(
        SimpleNamespace(
            name=name,
            raw_text="",
            review_required=True,
            success=True,
            issue_codes=(),
            preprocessing_variant="registered_whole_row",
            ocr_attempts=0,
        )
        for name in names
    )
    return _stage_result(
        status=status,
        success=status != "failed",
        data=SimpleNamespace(
            regions=regions,
            crops=crops,
            registered_width=1400,
            registered_height=1375,
        ),
    )


def _birth_ocr_result(status="review_required", success=True, issues=None):
    values = {
        "child_name": "Child One" if success else "",
        "mother_maiden_name": "Mother One" if success else "",
        "father_name": "Father One" if success else "",
    }
    fields = tuple(
        SimpleNamespace(
            name=name,
            raw_text=value,
            review_required=True,
            success=success,
            issue_codes=() if success else ("OCR_EXECUTION_FAILED",),
            preprocessing_variant="registered_whole_row_ocr",
            ocr_attempts=1,
        )
        for name, value in values.items()
    )
    return _stage_result(
        status=status,
        success=success,
        data=SimpleNamespace(fields=fields, field_count=3),
        issues=issues,
        metrics={"total_ocr_attempts": 3},
    )


def _indigency_result(status="review_required", success=True, issue_code=None):
    values = {
        "certificate_subject_name": "SUBJECT OCR",
        "issue_date": "16th day of July 2026",
        "issuing_barangay": "SAMPLE BARANGAY",
    }
    fields = tuple(
        SimpleNamespace(
            name=name,
            raw_text=value if success else "",
            success=success,
            review_required=True,
            issue_codes=() if success else (issue_code or "FIELD_NOT_EXTRACTED",),
            detection_variant="otsu_threshold",
            anchor="synthetic anchor",
            normalized_bounds=(0.1, 0.2, 0.3, 0.1) if success else None,
        )
        for name, value in values.items()
    )
    return _stage_result(
        status=status,
        success=success,
        data=(
            SimpleNamespace(
                fields=fields,
                field_count=3,
                detection_variant="otsu_threshold",
            )
            if success
            else None
        ),
        issues=[{"code": issue_code}] if issue_code else [],
        metrics={"field_count": 3, "manual_review_required": True},
    )


class JobWorkerTest(unittest.TestCase):
    def setUp(self):
        job_worker._shutdown_requested.clear()
        self.capture_patcher = patch(
            "job_worker.run_capture_session",
            return_value=CaptureSessionResult(CAPTURED, CAPTURE_PATH),
        )
        self.generic_ocr_patcher = patch(
            "job_worker._run_generic_ocr",
            return_value=("RAW OCR", "CORRECTED OCR"),
        )
        self.load_image_patcher = patch(
            "job_worker._load_registered_image",
            return_value=np.full((1375, 1400, 3), 240, dtype=np.uint8),
        )
        self.capture = self.capture_patcher.start()
        self.generic_ocr = self.generic_ocr_patcher.start()
        self.load_image = self.load_image_patcher.start()

    def tearDown(self):
        self.load_image_patcher.stop()
        self.generic_ocr_patcher.stop()
        self.capture_patcher.stop()
        job_worker._shutdown_requested.clear()

    @staticmethod
    def request(document_key, **overrides):
        request = {
            "request_id": "request-123456789",
            "application_id": "application-private",
            "student_id": "student-private",
            "student_name": "Private Student Name",
            "document_key": document_key,
            "document_type": document_key,
        }
        request.update(overrides)
        return request

    def test_generic_document_uses_one_shared_capture_and_same_path(self):
        success, payload = job_worker.run_scan(self.request("unknown_key"))

        self.assertTrue(success)
        self.capture.assert_called_once()
        self.generic_ocr.assert_called_once_with(CAPTURE_PATH)
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertEqual(payload["source_payload"]["capture_status"], CAPTURED)

    @patch("job_worker.write_text_file")
    @patch("job_worker.clear_tmp_files")
    def test_generic_ocr_preserves_raw_and_corrected_compatibility_outputs(
        self, clear_files, write_file
    ):
        self.generic_ocr_patcher.stop()
        reader = MagicMock(return_value="  RAW OCR  ")
        corrector = MagicMock(return_value="  CORRECTED OCR  ")
        try:
            raw_text, corrected_text = job_worker._run_generic_ocr(
                CAPTURE_PATH,
                text_reader=reader,
                text_corrector=corrector,
            )
        finally:
            self.generic_ocr = self.generic_ocr_patcher.start()

        clear_files.assert_called_once()
        reader.assert_called_once_with(CAPTURE_PATH)
        corrector.assert_called_once_with("RAW OCR", aggressive=False)
        self.assertEqual((raw_text, corrected_text), ("RAW OCR", "CORRECTED OCR"))
        self.assertEqual(
            write_file.call_args_list,
            [
                call("/tmp/ocr_raw.txt", "RAW OCR"),
                call("/tmp/ocr_result.txt", "CORRECTED OCR"),
            ],
        )

    def test_grade_form_uses_generic_ocr_for_same_captured_image(self):
        with patch("job_worker.register_psa_birth_form") as birth, patch(
            "job_worker.extract_indigency_core_fields"
        ) as indigency:
            success, payload = job_worker.run_scan(
                self.request("student_grade_forms")
            )

        self.assertTrue(success)
        self.generic_ocr.assert_called_once_with(CAPTURE_PATH)
        birth.assert_not_called()
        indigency.assert_not_called()
        self.assertEqual(payload["source_payload"]["mode"], "interactive_camera")

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_uses_generic_ocr_then_existing_structured_extractor(self, extract):
        extract.return_value = _indigency_result()

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertTrue(success)
        self.generic_ocr.assert_called_once_with(CAPTURE_PATH)
        self.load_image.assert_called_once_with(CAPTURE_PATH)
        extract.assert_called_once()
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(
            set(payload["extracted_fields"]["fields"]),
            {"certificate_subject_name", "issue_date", "issuing_barangay"},
        )

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_alias_uses_same_pipeline(self, extract):
        extract.return_value = _indigency_result()

        success, _payload = job_worker.run_scan(self.request("indigency"))

        self.assertTrue(success)
        extract.assert_called_once()

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_uses_same_capture_without_generic_ocr(
        self, register, crop, ocr
    ):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        ocr.return_value = _birth_ocr_result()

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.capture.assert_called_once()
        self.load_image.assert_called_once_with(CAPTURE_PATH)
        self.generic_ocr.assert_not_called()
        register.assert_called_once()
        crop.assert_called_once_with(
            register.return_value.data.registered_image,
            registration_metadata=_birth_registration_context(),
        )
        ocr.assert_called_once()
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["ocr_attempts"], 3)

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_all_birth_aliases_enter_shared_capture(self, register, crop, ocr):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        ocr.return_value = _birth_ocr_result()

        for alias in (
            "birth_certificate",
            "certificate_of_birth",
            "certificate_of_live_birth",
            "psa_birth_certificate",
        ):
            with self.subTest(alias=alias):
                self.capture.reset_mock()
                job_worker.run_scan(self.request(alias))
                self.capture.assert_called_once()

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_registration_review_propagates(self, register, crop, ocr):
        register.return_value = _birth_registration_result("review_required")
        crop.return_value = _birth_crop_result("review_required")
        ocr.return_value = _birth_ocr_result()

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.assertEqual(payload["source_payload"]["registration_status"], "review_required")
        self.assertEqual(payload["source_payload"]["cropper_status"], "review_required")
        self.assertEqual(payload["source_payload"]["ocr_status"], "review_required")

    @patch("job_worker.register_psa_birth_form")
    def test_birth_registration_failure_remains_failed(self, register):
        register.return_value = _stage_result(
            status="failed",
            success=False,
            issues=[{"code": "FORM_GRID_NOT_FOUND"}],
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(
            payload["source_payload"]["registration_issue_codes"],
            ["FORM_GRID_NOT_FOUND"],
        )

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_ocr_failure_remains_failed(self, register, crop, ocr):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        ocr.return_value = _birth_ocr_result(
            status="failed",
            success=False,
            issues=[{"code": "OCR_ALL_FIELDS_FAILED"}],
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["OCR_ALL_FIELDS_FAILED"],
        )

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_structured_failure_keeps_usable_raw_ocr(self, extract):
        extract.return_value = _indigency_result(
            status="failed",
            success=False,
            issue_code="INDIGENCY_DOCUMENT_NOT_DETECTED",
        )

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertEqual(payload["source_payload"]["ocr_status"], "failed")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_DOCUMENT_NOT_DETECTED"],
        )

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_extractor_exception_keeps_safe_fallback(self, extract):
        extract.side_effect = RuntimeError("sensitive internals")

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertTrue(success)
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_STRUCTURED_EXTRACTION_FAILED"],
        )

    def test_empty_generic_ocr_remains_failed(self):
        self.generic_ocr.return_value = ("", "")

        success, payload = job_worker.run_scan(self.request("student_grade_forms"))

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_missing_capture_image_keeps_raw_review(self, extract):
        self.load_image.return_value = None

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertTrue(success)
        extract.assert_not_called()
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_SOURCE_IMAGE_UNAVAILABLE"],
        )

    def test_right_cancellation_skips_every_ocr_pipeline(self):
        self.capture.return_value = CaptureSessionResult(CANCELLED)
        with patch("job_worker.register_psa_birth_form") as birth, patch(
            "job_worker.extract_indigency_core_fields"
        ) as indigency:
            success, payload = job_worker.run_scan(
                self.request("certificate_of_indigency")
            )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "cancelled")
        self.generic_ocr.assert_not_called()
        birth.assert_not_called()
        indigency.assert_not_called()

    def test_capture_failure_skips_every_ocr_pipeline(self):
        self.capture.return_value = CaptureSessionResult(
            FAILED,
            error_code="PREVIEW_START_FAILED",
        )
        with patch("job_worker.register_psa_birth_form") as birth, patch(
            "job_worker.extract_indigency_core_fields"
        ) as indigency:
            success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(
            payload["source_payload"]["capture_error_code"],
            "PREVIEW_START_FAILED",
        )
        self.generic_ocr.assert_not_called()
        birth.assert_not_called()
        indigency.assert_not_called()

    def test_worker_flow_has_no_subprocess_or_second_confirmation(self):
        source = inspect.getsource(job_worker)
        self.assertNotIn("subprocess.run", source)
        self.assertNotIn("Confirm Save", source)
        self.assertNotIn("Discard", source)

    def test_privacy_sensitive_request_values_are_absent_from_logs(self):
        request = self.request(
            "student_grade_forms",
            request_id="private-request-identifier",
            application_id="secret-application",
            student_id="secret-student",
            student_name="Secret Person",
        )

        with self.assertLogs("iot-worker", level="INFO") as captured:
            job_worker.run_scan(request)
        logs = "\n".join(captured.output)

        self.assertNotIn("private-request-identifier", logs)
        self.assertNotIn("secret-application", logs)
        self.assertNotIn("secret-student", logs)
        self.assertNotIn("Secret Person", logs)
        self.assertNotIn("RAW OCR", logs)

    def test_submit_and_verify_preserves_payload_contract(self):
        api = MagicMock()
        api.submit_result.return_value = {"ok": True}
        payload = {
            "status": "review_required",
            "raw_text": "provisional text",
            "ocr_confidence": None,
            "extracted_fields": {"document_type": "birth_certificate"},
            "source_payload": {"worker_status": "review_required"},
            "error_message": None,
        }

        self.assertTrue(job_worker.submit_and_verify(api, "request-123", payload))
        api.submit_result.assert_called_once_with(
            job_id="request-123",
            status="review_required",
            raw_text="provisional text",
            ocr_confidence=None,
            extracted_fields={"document_type": "birth_certificate"},
            source_payload={"worker_status": "review_required"},
            error_message=None,
        )


if __name__ == "__main__":
    unittest.main()
