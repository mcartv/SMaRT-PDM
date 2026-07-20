import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np

import job_worker


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
    metadata = SimpleNamespace(
        status=status,
        issues=[],
        transformation_metadata=SimpleNamespace(
            canonical_left_boundary=0.0,
            canonical_right_boundary=1.0,
            canonical_top_boundary=0.0,
            canonical_bottom_boundary=1.0,
            canonical_vertical_landmarks=(0.2, 0.5, 0.8),
            canonical_horizontal_landmarks=(0.1, 0.4, 0.7),
            maximum_canonical_edge_deviation=0.0,
        ),
    )
    return _stage_result(
        status=status,
        success=status != "failed",
        data=SimpleNamespace(
            registered_image=registered_image,
            transformation_metadata=metadata.transformation_metadata,
        ),
        issues=[],
    )


def _birth_registration_context(status="success"):
    result = _birth_registration_result(status=status)
    return {
        "status": result.status,
        "issues": result.issues,
        "transformation_metadata": result.data.transformation_metadata,
    }


def _birth_crop_result(status="success"):
    crops = {
        "child_name": np.full((193, 1400, 3), 10, dtype=np.uint8),
        "mother_maiden_name": np.full((117, 1400, 3), 20, dtype=np.uint8),
        "father_name": np.full((96, 1400, 3), 30, dtype=np.uint8),
    }
    fields = tuple(
        SimpleNamespace(
            name=name,
            raw_text="",
            review_required=True,
            success=True,
            issue_codes=(),
            preprocessing_variant="registered_whole_row",
            ocr_attempts=0,
        )
        for name in ("child_name", "mother_maiden_name", "father_name")
    )
    return _stage_result(
        status=status,
        success=status != "failed",
        data=SimpleNamespace(regions=fields, crops=crops, registered_width=1400, registered_height=1375),
        issues=[],
    )


def _birth_ocr_result(status="review_required", success=True, texts=None, issues=None, failed=False):
    if texts is None:
        texts = (
            {
                "child_name": "Child One",
                "mother_maiden_name": "Mother One",
                "father_name": "Father One",
            }
            if success
            else {
                "child_name": "",
                "mother_maiden_name": "",
                "father_name": "",
            }
        )
    fields = tuple(
        SimpleNamespace(
            name=name,
            raw_text=texts.get(name, ""),
            review_required=True,
            success=success,
            issue_codes=() if success else ("OCR_EXECUTION_FAILED",),
            preprocessing_variant="registered_whole_row_ocr",
            ocr_attempts=1,
        )
        for name in ("child_name", "mother_maiden_name", "father_name")
    )
    return _stage_result(
        status=status,
        success=success,
        data=SimpleNamespace(fields=fields, field_count=3),
        issues=list(issues or []),
        metrics={"total_ocr_attempts": 3},
    )


def _indigency_result(
    status="review_required",
    success=True,
    issue_code=None,
    values=None,
):
    resolved_values = values or {
        "certificate_subject_name": "SUBJECT OCR",
        "issue_date": "16th day of July 2026",
        "issuing_barangay": "SAMPLE BARANGAY",
    }
    fields = tuple(
        SimpleNamespace(
            name=name,
            raw_text=value if success else "",
            success=success and bool(value),
            review_required=True,
            issue_codes=(
                ()
                if success and value
                else (issue_code or "FIELD_NOT_EXTRACTED",)
            ),
            detection_variant="otsu_threshold",
            anchor="synthetic anchor",
            normalized_bounds=(0.1, 0.2, 0.3, 0.1) if success and value else None,
        )
        for name, value in resolved_values.items()
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
    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_uses_interactive_capture_then_structured_review_flow(
        self,
        mock_run,
        mock_read_text_file,
        mock_clear_tmp_files,
        mock_register,
        mock_crop,
        mock_birth_ocr,
        mock_load_image,
        mock_extract_indigency,
    ):
        raw_text = "CERTIFICATE OCR TEXT"
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = [raw_text, "CORRECTED METADATA ONLY"]
        source_image = np.full((1200, 900, 3), 240, dtype=np.uint8)
        mock_load_image.return_value = source_image
        mock_extract_indigency.return_value = _indigency_result()

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency",
                "application_id": "app-indigency",
                "student_id": "stud-indigency",
                "student_name": "Application Profile Name",
                "document_key": "certificate_of_indigency",
                "document_type": "Certificate of Indigency",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], raw_text)
        self.assertIsNone(payload["ocr_confidence"])
        self.assertTrue(payload["extracted_fields"]["review_required"])
        self.assertEqual(
            payload["extracted_fields"]["contract_status"],
            "approved",
        )
        self.assertEqual(
            set(payload["extracted_fields"]["fields"]),
            {"certificate_subject_name", "issue_date", "issuing_barangay"},
        )
        self.assertNotIn("applicant_name", payload["extracted_fields"]["fields"])
        self.assertEqual(
            payload["source_payload"]["corrected_text"],
            "CORRECTED METADATA ONLY",
        )
        self.assertEqual(
            payload["source_payload"]["document_contract_status"],
            "approved",
        )
        self.assertEqual(payload["source_payload"]["worker_status"], "review_required")
        self.assertEqual(payload["source_payload"]["ocr_status"], "review_required")
        self.assertNotIn("extracted_name", payload["extracted_fields"])
        mock_clear_tmp_files.assert_called_once()
        mock_load_image.assert_called_once_with("/tmp/raw_capture.jpg")
        mock_extract_indigency.assert_called_once_with(source_image)
        mock_register.assert_not_called()
        mock_crop.assert_not_called()
        mock_birth_ocr.assert_not_called()

    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_missing_field_keeps_usable_raw_ocr_review_required(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_load_image,
        mock_extract_indigency,
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]
        mock_load_image.return_value = np.full((1200, 900, 3), 240, dtype=np.uint8)
        mock_extract_indigency.return_value = _indigency_result(
            values={
                "certificate_subject_name": "SUBJECT OCR",
                "issue_date": "",
                "issuing_barangay": "SAMPLE BARANGAY",
            }
        )

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-partial",
                "document_key": "certificate_of_indigency",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertEqual(
            payload["extracted_fields"]["fields"]["issue_date"]["raw_text"],
            "",
        )
        self.assertIsNone(payload["error_message"])

    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_all_empty_fields_keep_usable_raw_ocr_review_required(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_load_image,
        mock_extract_indigency,
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]
        mock_load_image.return_value = np.full((1200, 900, 3), 240, dtype=np.uint8)
        mock_extract_indigency.return_value = _indigency_result(
            values={
                "certificate_subject_name": "",
                "issue_date": "",
                "issuing_barangay": "",
            }
        )

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-empty-fields",
                "document_key": "certificate_of_indigency",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertTrue(
            all(
                field["raw_text"] == "" and field["review_required"] is True
                for field in payload["extracted_fields"]["fields"].values()
            )
        )
        self.assertIsNone(payload["error_message"])

    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_extraction_failure_submits_empty_fields_and_issue_codes(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_load_image,
        mock_extract_indigency,
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]
        mock_load_image.return_value = np.full((1200, 900, 3), 240, dtype=np.uint8)
        mock_extract_indigency.return_value = _indigency_result(
            status="failed",
            success=False,
            issue_code="INDIGENCY_DOCUMENT_NOT_DETECTED",
        )

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-failed",
                "document_key": "certificate_of_indigency",
                "document_type": "Certificate of Indigency",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertIsNone(payload["error_message"])
        self.assertEqual(payload["source_payload"]["worker_status"], "review_required")
        self.assertEqual(payload["source_payload"]["ocr_status"], "failed")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_DOCUMENT_NOT_DETECTED"],
        )
        self.assertTrue(
            all(
                field["raw_text"] == "" and field["success"] is False
                for field in payload["extracted_fields"]["fields"].values()
            )
        )
        self.assertNotIn("applicant_name", payload["extracted_fields"]["fields"])

    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_extractor_exception_keeps_raw_ocr_and_safe_issue_code(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_load_image,
        mock_extract_indigency,
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]
        mock_load_image.return_value = np.full((1200, 900, 3), 240, dtype=np.uint8)
        mock_extract_indigency.side_effect = RuntimeError("sensitive OCR details")

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-exception",
                "document_key": "certificate_of_indigency",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertIsNone(payload["error_message"])
        self.assertEqual(payload["source_payload"]["ocr_status"], "failed")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_STRUCTURED_EXTRACTION_FAILED"],
        )
        self.assertTrue(
            all(
                field["raw_text"] == ""
                for field in payload["extracted_fields"]["fields"].values()
            )
        )

    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_missing_source_image_keeps_usable_raw_ocr(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_load_image,
        mock_extract_indigency,
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]
        mock_load_image.return_value = None

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-no-image",
                "document_key": "certificate_of_indigency",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertIsNone(payload["error_message"])
        self.assertEqual(payload["source_payload"]["ocr_status"], "failed")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_SOURCE_IMAGE_UNAVAILABLE"],
        )
        mock_extract_indigency.assert_not_called()

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_cancellation_remains_cancelled(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_register,
        mock_crop,
        mock_birth_ocr,
    ):
        mock_run.return_value.returncode = 2
        mock_read_text_file.side_effect = ["", ""]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-cancel",
                "document_key": "certificate_of_indigency",
                "document_type": "Certificate of Indigency",
            }
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "cancelled")
        self.assertEqual(payload["raw_text"], "")
        self.assertTrue(payload["source_payload"]["cancelled"])
        self.assertEqual(
            set(payload["extracted_fields"]["fields"]),
            {"certificate_subject_name", "issue_date", "issuing_barangay"},
        )
        self.assertTrue(
            all(
                not field["success"]
                for field in payload["extracted_fields"]["fields"].values()
            )
        )
        mock_register.assert_not_called()
        mock_crop.assert_not_called()
        mock_birth_ocr.assert_not_called()

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_empty_ocr_remains_failed(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_register,
        mock_crop,
        mock_birth_ocr,
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["", "CORRECTED TEXT MUST NOT SUCCEED"]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-empty",
                "document_key": "certificate_of_indigency",
                "document_type": "Certificate of Indigency",
            }
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")
        self.assertIsNone(payload["ocr_confidence"])
        self.assertEqual(
            set(payload["extracted_fields"]["fields"]),
            {"certificate_subject_name", "issue_date", "issuing_barangay"},
        )
        mock_register.assert_not_called()
        mock_crop.assert_not_called()
        mock_birth_ocr.assert_not_called()

    @patch("job_worker.extract_indigency_core_fields")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_indigency_subprocess_failure_remains_failed(
        self,
        mock_run,
        mock_read_text_file,
        _mock_clear_tmp_files,
        mock_load_image,
        mock_extract_indigency,
    ):
        mock_run.return_value.returncode = 1
        mock_read_text_file.side_effect = ["", ""]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-indigency-subprocess-failed",
                "document_key": "certificate_of_indigency",
            }
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")
        self.assertEqual(payload["source_payload"]["ocr_status"], "not_started")
        mock_load_image.assert_not_called()
        mock_extract_indigency.assert_not_called()

    @patch("job_worker.build_extracted_fields")
    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_non_birth_documents_keep_existing_raw_text_flow(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files, mock_build_extracted_fields
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]
        mock_build_extracted_fields.return_value = {"document_type": "unknown_document", "review_required": True}

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-1",
                "application_id": "app-1",
                "student_id": "stud-1",
                "student_name": "Jane Doe",
                "document_key": "unknown_key",
                "document_type": "Unknown Document",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["raw_text"], "RAW OCR")
        self.assertEqual(payload["source_payload"]["document_contract_status"], "missing")
        mock_clear_tmp_files.assert_called_once()
        mock_build_extracted_fields.assert_called_once_with("unknown_key", "RAW OCR")

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.CameraController")
    def test_birth_certificate_success_path_builds_structured_payload(
        self, mock_camera_cls, mock_load_image, mock_register, mock_crop, mock_ocr
    ):
        camera = MagicMock()
        camera.capture_file = "/tmp/raw_capture.jpg"
        camera.check_available.return_value = True
        camera.capture_image.return_value = True
        mock_camera_cls.return_value = camera
        mock_load_image.return_value = np.full((1375, 1400, 3), 240, dtype=np.uint8)
        mock_register.return_value = _birth_registration_result(status="success")
        mock_crop.return_value = _birth_crop_result(status="success")
        mock_ocr.return_value = _birth_ocr_result(status="review_required", success=True)

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-birth",
                "application_id": "app-2",
                "student_id": "stud-2",
                "student_name": "Jane Doe",
                "document_key": "birth_certificate",
                "document_type": "Birth Certificate",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "Child One\nMother One\nFather One")
        self.assertEqual(payload["document_type"], "birth_certificate")
        self.assertTrue(payload["manual_review_required"])
        self.assertEqual(payload["ocr_attempts"], 3)
        self.assertEqual(payload["preprocessing_variant"], "registered_whole_row_ocr")
        self.assertEqual(payload["extracted_fields"]["document_type"], "birth_certificate")
        self.assertEqual(payload["extracted_fields"]["fields"]["child_name"]["raw_text"], "Child One")
        self.assertTrue(payload["extracted_fields"]["review_required"])
        self.assertTrue(payload["source_payload"]["manual_review_required"])
        self.assertEqual(payload["source_payload"]["worker_status"], "review_required")
        self.assertEqual(payload["source_payload"]["ocr_attempts"], 3)
        self.assertEqual(payload["source_payload"]["preprocessing_variant"], "registered_whole_row_ocr")
        self.assertEqual(
            payload["source_payload"]["structured_field_keys"],
            ["child_name", "father_name", "mother_maiden_name"],
        )
        self.assertEqual(payload["source_payload"]["ocr_status"], "review_required")
        mock_register.assert_called_once()
        mock_crop.assert_called_once_with(
            mock_register.return_value.data.registered_image,
            registration_metadata=_birth_registration_context(status="success"),
        )
        mock_ocr.assert_called_once()

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    @patch("job_worker._load_registered_image")
    @patch("job_worker.CameraController")
    def test_birth_registration_review_required_propagates_to_cropper_and_worker(
        self, mock_camera_cls, mock_load_image, mock_register, mock_crop, mock_ocr
    ):
        camera = MagicMock()
        camera.capture_file = "/tmp/raw_capture.jpg"
        camera.check_available.return_value = True
        camera.capture_image.return_value = True
        mock_camera_cls.return_value = camera
        mock_load_image.return_value = np.full((1375, 1400, 3), 240, dtype=np.uint8)
        mock_register.return_value = _birth_registration_result(status="review_required")
        mock_crop.return_value = _birth_crop_result(status="review_required")
        mock_ocr.return_value = _birth_ocr_result(status="review_required", success=True)

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-birth-review",
                "application_id": "app-2",
                "student_id": "stud-2",
                "student_name": "Jane Doe",
                "document_key": "birth_certificate",
                "document_type": "Birth Certificate",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["source_payload"]["registration_status"], "review_required")
        self.assertEqual(payload["source_payload"]["cropper_status"], "review_required")
        self.assertEqual(payload["source_payload"]["ocr_status"], "review_required")
        self.assertEqual(payload["source_payload"]["worker_status"], "review_required")
        mock_crop.assert_called_once_with(
            mock_register.return_value.data.registered_image,
            registration_metadata=_birth_registration_context(status="review_required"),
        )

    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_birth_registration_failure_returns_failure_payload(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.side_effect = AssertionError("legacy subprocess path should not run for birth")
        mock_read_text_file.side_effect = AssertionError("legacy text files should not be read for birth")

        with patch("job_worker.CameraController") as mock_camera_cls, \
            patch("job_worker._load_registered_image") as mock_load_image, \
            patch("job_worker.register_psa_birth_form") as mock_register:
            camera = MagicMock()
            camera.capture_file = "/tmp/raw_capture.jpg"
            camera.check_available.return_value = True
            camera.capture_image.return_value = True
            mock_camera_cls.return_value = camera
            mock_load_image.return_value = np.full((1375, 1400, 3), 240, dtype=np.uint8)
            mock_register.return_value = _stage_result(status="failed", success=False, data=None, issues=[{"code": "FORM_GRID_NOT_FOUND"}])

            success, payload = job_worker.run_scan(
                {
                    "request_id": "req-fail",
                    "application_id": "app-3",
                    "student_id": "stud-3",
                    "student_name": "Jane Doe",
                    "document_key": "birth_certificate",
                    "document_type": "Birth Certificate",
                }
            )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["document_type"], "birth_certificate")
        self.assertEqual(payload["source_payload"]["registration_status"], "failed")
        self.assertEqual(payload["source_payload"]["registration_issue_codes"], ["FORM_GRID_NOT_FOUND"])
        self.assertEqual(payload["source_payload"]["structured_field_keys"], [])
        self.assertEqual(payload["source_payload"]["worker_status"], "failed")
        self.assertEqual(payload["extracted_fields"]["fields"], {})
        mock_clear_tmp_files.assert_not_called()

    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_birth_ocr_failure_propagates_stage_result_and_issue_codes(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.side_effect = AssertionError("legacy subprocess path should not run for birth")
        mock_read_text_file.side_effect = AssertionError("legacy text files should not be read for birth")

        with patch("job_worker.CameraController") as mock_camera_cls, \
            patch("job_worker._load_registered_image") as mock_load_image, \
            patch("job_worker.register_psa_birth_form") as mock_register, \
            patch("job_worker.crop_psa_birth_name_rows") as mock_crop, \
            patch("job_worker.extract_psa_birth_row_text") as mock_ocr:
            camera = MagicMock()
            camera.capture_file = "/tmp/raw_capture.jpg"
            camera.check_available.return_value = True
            camera.capture_image.return_value = True
            mock_camera_cls.return_value = camera
            mock_load_image.return_value = np.full((1375, 1400, 3), 240, dtype=np.uint8)
            mock_register.return_value = _birth_registration_result(status="success")
            mock_crop.return_value = _birth_crop_result(status="success")
            mock_ocr.return_value = _birth_ocr_result(status="failed", success=False, issues=[{"code": "OCR_ALL_FIELDS_FAILED"}])

            success, payload = job_worker.run_scan(
                {
                    "request_id": "req-ocr-fail",
                    "application_id": "app-4",
                    "student_id": "stud-4",
                    "student_name": "Jane Doe",
                    "document_key": "birth_certificate",
                    "document_type": "Birth Certificate",
                }
            )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["document_type"], "birth_certificate")
        self.assertEqual(payload["source_payload"]["ocr_status"], "failed")
        self.assertEqual(payload["source_payload"]["ocr_issue_codes"], ["OCR_ALL_FIELDS_FAILED"])
        self.assertEqual(payload["source_payload"]["structured_field_keys"], ["child_name", "father_name", "mother_maiden_name"])
        self.assertEqual(payload["source_payload"]["worker_status"], "failed")
        self.assertEqual(payload["error_message"], "Birth OCR adapter failed.")

    def test_submit_and_verify_forwards_birth_payload_without_dead_top_level_metadata(self):
        api = MagicMock()
        api.submit_result.return_value = {"ok": True}
        payload = {
            "status": "review_required",
            "raw_text": "line1\nline2",
            "ocr_confidence": None,
            "extracted_fields": {"document_type": "birth_certificate"},
            "source_payload": {
                "mode": "birth_certificate_pipeline",
                "manual_review_required": True,
                "ocr_attempts": 3,
                "preprocessing_variant": "registered_whole_row_ocr",
                "structured_field_keys": ["child_name", "father_name", "mother_maiden_name"],
                "worker_status": "review_required",
            },
            "error_message": None,
        }

        self.assertTrue(job_worker.submit_and_verify(api, "req-9", payload))
        api.submit_result.assert_called_once_with(
            job_id="req-9",
            status="review_required",
            raw_text="line1\nline2",
            ocr_confidence=None,
            extracted_fields={"document_type": "birth_certificate"},
            source_payload={
                "mode": "birth_certificate_pipeline",
                "manual_review_required": True,
                "ocr_attempts": 3,
                "preprocessing_variant": "registered_whole_row_ocr",
                "structured_field_keys": ["child_name", "father_name", "mother_maiden_name"],
                "worker_status": "review_required",
            },
            error_message=None,
        )

    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_unknown_document_key_is_safe_and_returns_review_payload(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.return_value.returncode = 0
        mock_read_text_file.side_effect = ["RAW OCR", "CORRECTED OCR"]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-2",
                "application_id": "app-2",
                "student_id": "stud-2",
                "student_name": "Jane Doe",
                "document_key": "unknown_key",
                "document_type": "Unknown Document",
            }
        )

        self.assertTrue(success)
        self.assertEqual(payload["extracted_fields"]["document_type"], "unknown_document")
        self.assertTrue(payload["extracted_fields"]["review_required"])
        self.assertEqual(payload["source_payload"]["document_contract_status"], "missing")
        mock_clear_tmp_files.assert_called_once()

    @patch("job_worker.clear_tmp_files")
    @patch("job_worker.read_text_file")
    @patch("job_worker.subprocess.run")
    def test_failed_contract_resolution_does_not_crash_worker_path(
        self, mock_run, mock_read_text_file, mock_clear_tmp_files
    ):
        mock_run.return_value.returncode = 1
        mock_read_text_file.side_effect = ["", ""]

        success, payload = job_worker.run_scan(
            {
                "request_id": "req-3",
                "application_id": "app-3",
                "student_id": "stud-3",
                "student_name": "Jane Doe",
                "document_key": "",
                "document_type": "",
            }
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["extracted_fields"]["document_type"], "unknown_document")
        self.assertTrue(payload["extracted_fields"]["review_required"])
        mock_clear_tmp_files.assert_called_once()


if __name__ == "__main__":
    unittest.main()
