import unittest
from unittest.mock import MagicMock, patch

from api import ApiClient


class ApiClientTest(unittest.TestCase):
    def _client(self):
        client = ApiClient.__new__(ApiClient)
        client.base_url = "https://example.invalid"
        client.pi_token = "test-token"
        client.device_id = "test-device"
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


if __name__ == "__main__":
    unittest.main()
