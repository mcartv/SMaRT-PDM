import inspect
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

import numpy as np

sys.modules.setdefault("api", SimpleNamespace(ApiClient=MagicMock))

import job_worker
from capture_session import CANCELLED, CAPTURED, FAILED, CaptureSessionResult
from extraction.gemini_birth_extractor import GeminiBirthResult


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


def _birth_topology_result():
    return _stage_result(
        status="success",
        success=True,
        data={
            "child_name": object(),
            "mother_maiden_name": object(),
            "father_name": object(),
        },
        metrics={"topology_status": "matched", "validated_row_count": 3},
    )


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
            row_crops=crops,
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
            components={
                "first_name": value.split()[0] if value else "",
                "middle_name": "",
                "last_name": value.split()[-1] if value else "",
            },
            section_status="present",
            review_required=True,
            success=success,
            issue_codes=() if success else ("OCR_EXECUTION_FAILED",),
            preprocessing_variant="registered_whole_row_ocr",
            ocr_attempts=1,
            confidence=91.0,
            component_confidence={
                "first_name": 91.0,
                "middle_name": None,
                "last_name": 91.0,
            },
            component_raw_text={
                "first_name": value.split()[0] if value else "",
                "middle_name": "",
                "last_name": value.split()[-1] if value else "",
            },
        )
        for name, value in values.items()
    )
    return _stage_result(
        status=status,
        success=success,
        data=SimpleNamespace(fields=fields, field_count=3),
        issues=issues,
        metrics={
            "total_ocr_attempts": 27,
            "confidence_source": "tesseract_image_to_data_three_variant_vote",
            "variant_observations": {"child_name.first_name": []},
        },
    )


def _indigency_result(status="review_required", success=True, issue_code=None):
    raw_page_text = (
        "CERTIFICATE OF INDIGENCY\n"
        "This is to certify that SUBJECT OCR is a bona fide resident of "
        "12 SAMPLE STREET MARILAO BULACAN."
    )
    values = {
        "certificate_subject_name": "SUBJECT OCR",
        "residency_address": "12 SAMPLE STREET MARILAO BULACAN",
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
                raw_text=raw_page_text,
                fields=fields,
                field_count=4,
                detection_variant="otsu_threshold",
            )
            if success
            else None
        ),
        issues=[{"code": issue_code}] if issue_code else [],
        metrics={"field_count": 4, "manual_review_required": True},
    )


def _grade_form_result(*, matched=True, raw_text="GWA: 1.63", fields=None):
    return SimpleNamespace(
        matched=matched,
        raw_text=raw_text,
        fields=fields or {},
        field_confidence={},
        validation_issues=([] if matched else [{
            "code": "GRADE_FORM_V1_TEMPLATE_MISMATCH",
            "message": "Approved grade form labels could not be registered.",
        }]),
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
        self.birth_topology_patcher = patch(
            "job_worker.validate_psa_birth_name_topology",
            return_value=_birth_topology_result(),
        )
        self.capture = self.capture_patcher.start()
        self.generic_ocr = self.generic_ocr_patcher.start()
        self.load_image = self.load_image_patcher.start()
        self.birth_topology = self.birth_topology_patcher.start()

    def tearDown(self):
        self.birth_topology_patcher.stop()
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

    def test_grade_form_uses_continuous_autofocus_without_changing_indigency(self):
        grade_camera = SimpleNamespace(
            fixed_lens_position=1.50,
            focus_mode="manual",
            capture_profile="default",
            capture_width=2304,
            capture_height=1296,
        )
        indigency_camera = SimpleNamespace(
            fixed_lens_position=1.50,
            focus_mode="manual",
            capture_profile="default",
            capture_width=2304,
            capture_height=1296,
        )
        birth_camera = SimpleNamespace(
            fixed_lens_position=1.50,
            focus_mode="manual",
            capture_profile="default",
            capture_width=2304,
            capture_height=1296,
        )

        job_worker._configure_camera_for_document(
            grade_camera,
            "student_grade_forms",
        )
        job_worker._configure_camera_for_document(
            indigency_camera,
            "certificate_of_indigency",
        )
        job_worker._configure_camera_for_document(
            birth_camera,
            "birth_certificate",
        )

        self.assertEqual(grade_camera.fixed_lens_position, 1.50)
        self.assertEqual(indigency_camera.fixed_lens_position, 1.50)
        self.assertEqual(birth_camera.fixed_lens_position, 1.50)
        self.assertEqual(birth_camera.focus_mode, "continuous")
        self.assertEqual(grade_camera.focus_mode, "continuous")
        self.assertEqual(indigency_camera.focus_mode, "manual")
        self.assertEqual(grade_camera.capture_profile, "default")
        self.assertEqual(indigency_camera.capture_profile, "default")
        self.assertEqual(grade_camera.capture_width, 2304)
        self.assertEqual(indigency_camera.capture_width, 2304)
        self.assertEqual(birth_camera.capture_profile, "psa_birth_v1")
        self.assertEqual(birth_camera.capture_width, 4608)
        self.assertEqual(birth_camera.capture_height, 2592)

    def test_generic_document_uses_one_shared_capture_and_same_path(self):
        success, payload = job_worker.run_scan(self.request("unknown_key"))

        self.assertTrue(success)
        self.capture.assert_called_once()
        self.generic_ocr.assert_called_once_with(CAPTURE_PATH)
        self.assertEqual(payload["status"], "review_required")
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

    @patch("job_worker.scan_grade_form")
    def test_grade_form_uses_registered_single_pass_for_same_captured_image(self, scan):
        scan.return_value = _grade_form_result(
            fields={"gwa": {"raw_text": "1.63", "normalized_value": "1.63"}}
        )
        success, payload = job_worker._run_grade_form_scan(
            self.request("student_grade_forms"),
            CAPTURE_PATH,
        )

        self.assertTrue(success)
        scan.assert_called_once_with(CAPTURE_PATH)
        self.generic_ocr.assert_not_called()
        self.assertEqual(
            payload["source_payload"]["mode"],
            "grade_form_registered_single_pass",
        )

    @patch("job_worker.scan_grade_form")
    def test_grade_form_registration_mismatch_returns_raw_review_candidate(self, scan):
        scan.return_value = _grade_form_result(
            matched=False,
            raw_text=(
                "STUDENT NUMBER PDM-2023-003137 "
                "GRADE FOR THE PERIOD 1st 2023-2024 GWA: 1.63"
            ),
        )

        success, payload = job_worker._run_grade_form_scan(
            self.request("student_grade_forms"),
            CAPTURE_PATH,
        )

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["source_payload"]["registration_status"], "mismatch")
        self.assertIn("GWA: 1.63", payload["raw_text"])
        self.assertEqual(payload["extracted_fields"]["fields"], {})

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_skips_generic_ocr_and_uses_one_structured_pass(self, extract):
        extract.return_value = _indigency_result()

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertTrue(success)
        self.generic_ocr.assert_not_called()
        self.load_image.assert_called_once_with(CAPTURE_PATH)
        extract.assert_called_once()
        self.assertEqual(payload["status"], "review_required")
        self.assertTrue(payload["source_payload"]["generic_ocr_skipped"])
        self.assertEqual(payload["source_payload"]["generic_ocr_seconds"], 0.0)
        self.assertEqual(payload["source_payload"]["registration_status"], "matched")
        self.assertEqual(payload["raw_text"], extract.return_value.data.raw_text)
        self.assertNotIn("Certificate Subject Name:", payload["raw_text"])
        self.assertNotIn("Full Address:", payload["raw_text"])
        self.assertEqual(payload["source_payload"]["raw_text_mode"], "tesseract_page_words")
        self.assertEqual(
            set(payload["extracted_fields"]["fields"]),
            {
                "certificate_subject_name",
                "residency_address",
            },
        )
        config = extract.call_args.kwargs["config"]
        self.assertFalse(config.include_optional_fields)

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_alias_uses_same_pipeline(self, extract):
        extract.return_value = _indigency_result()

        success, _payload = job_worker.run_scan(self.request("indigency"))

        self.assertTrue(success)
        extract.assert_called_once()

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_uses_nine_cell_raw_snapshot_without_full_page_ocr(
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
            topology=self.birth_topology.return_value.data,
        )
        ocr.assert_called_once()
        self.assertEqual(ocr.call_args.kwargs, {})
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["ocr_attempts"], 27)
        self.assertEqual(
            payload["raw_text"],
            "Child\t\tOne\nMother\t\tOne\nFather\t\tOne",
        )
        self.assertEqual(
            payload["field_confidence"],
            {
                "child_name": 91.0,
                "mother_maiden_name": 91.0,
                "father_name": 91.0,
            },
        )
        self.assertEqual(payload["source_payload"]["topology_status"], "matched")
        self.assertEqual(
            payload["source_payload"]["raw_text_mode"],
            "nine_cell_selected_observations",
        )
        self.assertEqual(payload["source_payload"]["manual_entry_status"], "disabled")
        self.assertFalse(payload["source_payload"]["paddle_enabled"])

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_worker_never_opens_pi_local_manual_entry(
        self,
        register,
        crop,
        ocr,
    ):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        ocr.return_value = _birth_ocr_result()

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        fields = payload["extracted_fields"]["fields"]
        self.assertEqual(
            fields["mother_maiden_name"]["components"]["first_name"],
            "Mother",
        )
        self.assertEqual(payload["field_confidence"]["mother_maiden_name"], 91.0)
        self.assertEqual(payload["source_payload"]["manual_entry_status"], "disabled")
        self.assertNotIn("image", payload)
        self.assertNotIn("capture_path", payload)

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_topology_failure_never_crops_or_runs_structured_ocr(
        self, register, crop, ocr
    ):
        register.return_value = _birth_registration_result()
        self.birth_topology.return_value = _stage_result(
            status="failed",
            success=False,
            issues=[{"code": "BIRTH_NAME_ROW_TOPOLOGY_INVALID"}],
            metrics={"topology_status": "mismatch"},
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertFalse(success)
        crop.assert_not_called()
        ocr.assert_not_called()
        self.generic_ocr.assert_not_called()
        self.assertEqual(payload["raw_text"], "")
        self.assertEqual(payload["extracted_fields"]["fields"], {})
        self.assertEqual(payload["source_payload"]["topology_status"], "mismatch")

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

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_retries_registration_with_validated_station_tolerances(
        self, register, crop, ocr
    ):
        register.side_effect = [
            _stage_result(
                status="failed",
                success=False,
                issues=[{"code": "FORM_GRID_NOT_FOUND"}],
            ),
            _birth_registration_result("review_required"),
        ]
        crop.return_value = _birth_crop_result("review_required")
        ocr.return_value = _birth_ocr_result()

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.assertEqual(register.call_count, 2)
        self.assertEqual(
            register.call_args_list[1].kwargs["config"],
            job_worker.BIRTH_RELAXED_REGISTRATION_CONFIG,
        )
        self.generic_ocr.assert_not_called()
        self.assertEqual(
            payload["source_payload"]["registration_mode"],
            "relaxed_validated_grid",
        )
        self.assertEqual(payload["source_payload"]["registration_attempts"], 2)
        self.assertTrue(payload["extracted_fields"]["fields"])

    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form_grid_envelope")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_uses_validated_grid_envelope_before_calibrated_crops(
        self, register, envelope, crop, ocr
    ):
        register.return_value = _stage_result(
            status="failed",
            success=False,
            issues=[{"code": "FORM_GRID_NOT_FOUND"}],
        )
        envelope.return_value = _birth_registration_result("review_required")
        crop.return_value = _birth_crop_result("review_required")
        ocr.return_value = _birth_ocr_result()

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.assertEqual(register.call_count, 2)
        envelope.assert_called_once()
        crop.assert_called_once_with(
            envelope.return_value.data.registered_image,
            registration_metadata=_birth_registration_context("review_required"),
            topology=self.birth_topology.return_value.data,
        )
        self.generic_ocr.assert_not_called()
        self.assertEqual(
            payload["source_payload"]["registration_mode"],
            "validated_grid_envelope",
        )
        self.assertEqual(payload["source_payload"]["registration_attempts"], 3)
        self.assertTrue(payload["extracted_fields"]["fields"])

    @patch("job_worker.register_psa_birth_form")
    def test_birth_registration_failure_never_creates_unstructured_candidate(self, register):
        register.return_value = _stage_result(
            status="failed",
            success=False,
            issues=[{"code": "FORM_GRID_NOT_FOUND"}],
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")
        self.assertEqual(payload["extracted_fields"]["fields"], {})
        self.generic_ocr.assert_not_called()
        self.assertEqual(payload["source_payload"]["registration_status"], "mismatch")
        self.assertEqual(
            payload["source_payload"]["registration_issue_codes"],
            ["FORM_GRID_ENVELOPE_TOPOLOGY_INVALID"],
        )

    @patch("job_worker.register_psa_birth_form")
    def test_birth_registration_failure_does_not_run_full_page_ocr(self, register):
        register.return_value = _stage_result(
            status="failed",
            success=False,
            issues=[{"code": "FORM_GRID_NOT_FOUND"}],
        )
        self.generic_ocr.return_value = ("", "")

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")
        self.assertEqual(
            payload["validation_issues"][0]["code"],
            "PSA_BIRTH_V1_TEMPLATE_MISMATCH",
        )
        self.assertEqual(payload["source_payload"]["registration_status"], "mismatch")
        self.generic_ocr.assert_not_called()
        self.assertGreaterEqual(register.call_count, 1)
        self.birth_topology.assert_not_called()

    @patch("job_worker._run_birth_diagnostic_ocr", return_value="UNSTRUCTURED PAGE OCR\n")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_registration_failure_persists_diagnostic_review_candidate(
        self,
        register,
        diagnostic_ocr,
    ):
        register.return_value = _stage_result(
            status="failed",
            success=False,
            issues=[{"code": "FORM_NOT_REGISTERED"}],
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.assertEqual(payload["status"], "review_required")
        self.assertEqual(payload["raw_text"], "UNSTRUCTURED PAGE OCR\n")
        self.assertEqual(payload["extracted_fields"]["fields"], {})
        self.assertTrue(payload["source_payload"]["diagnostic_only"])
        self.assertEqual(
            payload["source_payload"]["raw_text_mode"],
            "diagnostic_full_page_tesseract",
        )
        diagnostic_ocr.assert_called_once()

    @patch("job_worker.extract_with_gemini")
    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_gemini_structured_fields_keep_tesseract_raw_snapshot(
        self,
        register,
        crop,
        tesseract,
        gemini,
    ):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        tesseract.return_value = _birth_ocr_result()
        gemini.return_value = GeminiBirthResult(
            success=True,
            enabled=True,
            model="gemini-2.5-flash",
            fields={
                "child_first_name": "GEMINI CHILD",
                "child_middle_name": "",
                "child_last_name": "SURNAME",
                "mothers_maiden_first": "GEMINI MOTHER",
                "mothers_maiden_middle": "MIDDLE",
                "mothers_maiden_last": "MAIDEN",
                "father_first_name": "",
                "father_middle_name": "",
                "father_last_name": "",
            },
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        self.assertEqual(
            payload["raw_text"],
            "Child\t\tOne\nMother\t\tOne\nFather\t\tOne",
        )
        child = payload["extracted_fields"]["fields"]["child_name"]
        self.assertEqual(child["components"]["first_name"], "GEMINI CHILD")
        self.assertIsNone(child["component_confidence"]["first_name"])
        self.assertEqual(payload["source_payload"]["ocr_engine"], "gemini")
        self.assertEqual(payload["source_payload"]["gemini_status"], "selected")
        candidate = job_worker.candidate_from_worker_payload(
            self.request("birth_certificate"), payload
        ).serialize()
        self.assertEqual(candidate["processing"]["ocr_engine"], "gemini")
        self.assertEqual(candidate["raw_text"], payload["raw_text"])
        self.assertNotIn("image", repr(candidate).lower())

    @patch("job_worker.extract_with_gemini")
    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_gemini_failure_uses_existing_tesseract_candidate(
        self,
        register,
        crop,
        tesseract,
        gemini,
    ):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        tesseract.return_value = _birth_ocr_result()
        gemini.return_value = GeminiBirthResult(
            success=False,
            enabled=True,
            model="gemini-2.5-flash",
            error_code="TIMEOUT",
        )

        success, payload = job_worker.run_scan(self.request("birth_certificate"))

        self.assertTrue(success)
        child = payload["extracted_fields"]["fields"]["child_name"]
        self.assertEqual(child["components"]["first_name"], "Child")
        self.assertEqual(payload["source_payload"]["ocr_engine"], "tesseract")
        self.assertEqual(payload["source_payload"]["gemini_error_code"], "TIMEOUT")

    @patch("job_worker.extract_with_gemini")
    @patch("job_worker.extract_psa_birth_row_text")
    @patch("job_worker.crop_psa_birth_name_rows")
    @patch("job_worker.register_psa_birth_form")
    def test_birth_stop_before_engines_skips_gemini_and_tesseract(
        self,
        register,
        crop,
        tesseract,
        gemini,
    ):
        register.return_value = _birth_registration_result()
        crop.return_value = _birth_crop_result()
        stop = MagicMock()
        stop.is_set.return_value = True

        success, payload = job_worker._run_birth_certificate_scan(
            self.request("birth_certificate"),
            CAPTURE_PATH,
            request_stop=stop,
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "cancelled")
        tesseract.assert_not_called()
        gemini.assert_not_called()

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
    def test_indigency_structured_failure_does_not_run_generic_fallback(self, extract):
        extract.return_value = _indigency_result(
            status="failed",
            success=False,
            issue_code="INDIGENCY_DOCUMENT_NOT_DETECTED",
        )

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")
        self.generic_ocr.assert_not_called()
        self.assertEqual(payload["source_payload"]["ocr_status"], "failed")
        self.assertEqual(payload["source_payload"]["registration_status"], "mismatch")
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_DOCUMENT_NOT_DETECTED"],
        )

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_extractor_exception_fails_without_second_ocr(self, extract):
        extract.side_effect = RuntimeError("sensitive internals")

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertFalse(success)
        self.assertEqual(payload["raw_text"], "")
        self.generic_ocr.assert_not_called()
        self.assertEqual(
            payload["source_payload"]["ocr_issue_codes"],
            ["INDIGENCY_STRUCTURED_EXTRACTION_FAILED"],
        )

    @patch("job_worker.scan_grade_form")
    def test_empty_grade_form_ocr_remains_failed(self, scan):
        scan.return_value = _grade_form_result(matched=False, raw_text="")

        success, payload = job_worker._run_grade_form_scan(
            self.request("student_grade_forms"),
            CAPTURE_PATH,
        )

        self.assertFalse(success)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["raw_text"], "")

    @patch("job_worker.extract_indigency_core_fields")
    def test_indigency_missing_capture_image_fails_without_generic_ocr(self, extract):
        self.load_image.return_value = None

        success, payload = job_worker.run_scan(
            self.request("certificate_of_indigency")
        )

        self.assertFalse(success)
        extract.assert_not_called()
        self.generic_ocr.assert_not_called()
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
        fields = {"child_name": {"raw_text": "CHILD NAME", "success": True}}
        payload = {
            "status": "review_required",
            "raw_text": "provisional text",
            "ocr_confidence": None,
            "extracted_fields": {
                "document_type": "birth_certificate",
                "fields": fields,
            },
            "source_payload": {"registration_status": "matched"},
            "error_message": None,
        }

        self.assertTrue(job_worker.submit_and_verify(
            api,
            "request-123",
            payload,
            request={
                "request_id": "request-123",
                "document_key": "birth_certificate",
            },
        ))
        api.submit_result.assert_called_once_with(
            job_id="request-123",
            status="review_required",
            raw_text="provisional text",
            extracted_fields={
                "template_id": "psa_birth_v1",
                "document_key": "certificate_of_live_birth",
                "fields": fields,
                "field_confidence": {},
                "validation_issues": [],
            },
            source_payload={
                "registration_status": "matched",
                "preprocessing_variant": "psa_birth_v1",
                "ocr_engine": "tesseract",
                "registration_mode": "",
                "topology_status": "unknown",
                "topology_validated_row_count": 0,
                "topology_rows": {},
                "confidence_source": "",
                "gemini_enabled": False,
                "gemini_status": "disabled",
                "gemini_model": "",
                "gemini_error_code": "",
                "row_identity_status": "unknown",
                "row_identity_rows": {},
                "diagnostic_only": False,
                "raw_text_mode": "",
                "calibration": {},
            },
        )


if __name__ == "__main__":
    unittest.main()
