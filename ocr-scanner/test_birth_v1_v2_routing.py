import inspect
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.modules.setdefault("api", SimpleNamespace(ApiClient=MagicMock))

import job_worker


class BirthVersionRoutingContractTest(unittest.TestCase):
    def test_v1_never_enters_v2_upload_path(self):
        source = inspect.getsource(job_worker._run_birth_certificate_v1_scan)
        self.assertNotIn("submit_birth_v2_artifacts", source)
        self.assertIn("extract_psa_birth_row_text", source)

    def test_v2_never_runs_pi_ocr_or_v1_fallback(self):
        source = inspect.getsource(job_worker._run_birth_certificate_v2_scan)
        self.assertNotIn("extract_psa_birth_row_text", source)
        self.assertNotIn("pytesseract", source)
        self.assertNotIn("_run_birth_certificate_v1_scan", source)
        self.assertIn("submit_birth_v2_artifacts", source)

    def test_signed_artifact_transport_does_not_submit_paths_in_candidate(self):
        module_source = Path(__file__).with_name("api.py").read_text(encoding="utf-8")
        source = module_source[module_source.index("    def submit_birth_v2_artifacts"):]
        self.assertNotIn("submit_result", source)
        self.assertIn("sha256", source)
        self.assertIn("capture-artifacts/complete", source)

    def test_v2_completion_waits_for_bounded_backend_gemini_stages(self):
        module_source = Path(__file__).with_name("api.py").read_text(encoding="utf-8")
        self.assertIn("BIRTH_V2_COMPLETION_TIMEOUT_SECONDS", module_source)
        self.assertIn("timeout=self.birth_v2_completion_timeout", module_source)


if __name__ == "__main__":
    unittest.main()
