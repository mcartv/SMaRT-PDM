import unittest
from unittest.mock import MagicMock, patch

from api import ApiClient, resolve_device_id


class ApiClientTest(unittest.TestCase):
    def _client(self):
        client = ApiClient.__new__(ApiClient)
        client.base_url = "https://example.invalid"
        client.pi_token = "test-token"
        client.device_id = "2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11"
        client.timeout = 10
        return client

    @patch("api.requests.post")
    def test_indigency_review_status_is_transport_completed_with_provenance(self, mock_post):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"ok": True}
        mock_post.return_value = response

        result = self._client().submit_result(
            job_id="request-id",
            status="review_required",
            raw_text="RAW OCR",
            extracted_fields={
                "document_type": "certificate_of_indigency",
                "review_required": True,
            },
            source_payload={
                "mode": "indigency_structured_pipeline",
                "manual_review_required": True,
                "worker_status": "review_required",
            },
        )

        self.assertEqual(result, {"ok": True})
        payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["source_payload"]["worker_status"], "review_required")
        self.assertEqual(
            payload["extracted_fields"]["document_type"],
            "certificate_of_indigency",
        )

    @patch("api.requests.post")
    def test_unrelated_review_status_is_not_silently_normalized(self, mock_post):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"ok": True}
        mock_post.return_value = response

        self._client().submit_result(
            job_id="request-id",
            status="review_required",
            source_payload={
                "mode": "unrelated_pipeline",
                "manual_review_required": True,
            },
        )

        self.assertEqual(mock_post.call_args.kwargs["json"]["status"], "review_required")

    def test_configured_device_id_must_be_uuid(self):
        self.assertEqual(
            resolve_device_id("2E4E1E90-3D8A-4C59-B1EF-B7AE8A8D2B11"),
            "2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11",
        )

        with self.assertRaisesRegex(RuntimeError, "must be a valid UUID"):
            resolve_device_id("pi-001")

    @patch("api._read_machine_identity", return_value="raspberry-pi-test")
    def test_missing_device_id_derives_stable_uuid(self, _mock_identity):
        first = resolve_device_id("")
        second = resolve_device_id("")
        self.assertEqual(first, second)
        self.assertEqual(len(first), 36)


if __name__ == "__main__":
    unittest.main()
