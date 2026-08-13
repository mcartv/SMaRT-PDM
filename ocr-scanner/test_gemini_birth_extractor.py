import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np

from extraction.gemini_birth_extractor import (
    CELL_KEYS,
    CELL_LABELS,
    FIELD_KEYS,
    extract_with_gemini,
)


class _Part:
    @staticmethod
    def from_bytes(*, data, mime_type):
        return {"data": data, "mime_type": mime_type}


class _Config:
    def __init__(self, **values):
        self.values = values


class GeminiBirthExtractorTest(unittest.TestCase):
    def setUp(self):
        self.crops = {
            key: np.full((30, 120, 3), index + 1, dtype=np.uint8)
            for index, key in enumerate(CELL_KEYS)
        }
        self.fields = {
            "child_first_name": "VENICE EVE",
            "child_middle_name": "",
            "child_last_name": "PELIMA",
            "mothers_maiden_first": "ROWENA",
            "mothers_maiden_middle": "FRANCISCO",
            "mothers_maiden_last": "PELIMA",
            "father_first_name": "",
            "father_middle_name": "",
            "father_last_name": "",
        }
        self.types = SimpleNamespace(Part=_Part, GenerateContentConfig=_Config)

    def _client(self, payload=None, side_effect=None):
        generate = MagicMock(
            return_value=SimpleNamespace(text=json.dumps(payload or {
                "template_id": "psa_birth_v1",
                "fields": self.fields,
            })),
            side_effect=side_effect,
        )
        return SimpleNamespace(models=SimpleNamespace(generate_content=generate)), generate

    def test_success_sends_nine_cells_in_physical_order(self):
        client, generate = self._client()
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            result = extract_with_gemini(
                self.crops,
                enabled=True,
                api_key="test-key",
                client=client,
            )

        self.assertTrue(result.success)
        self.assertEqual(dict(result.fields), self.fields)
        contents = generate.call_args.kwargs["contents"]
        self.assertEqual(contents[1::2], list(CELL_LABELS))
        image_parts = contents[2::2]
        self.assertEqual(len(image_parts), 9)
        self.assertTrue(all(item["mime_type"] == "image/jpeg" for item in image_parts))

    def test_incomplete_required_names_falls_back(self):
        payload = {
            "template_id": "psa_birth_v1",
            "fields": {**self.fields, "mothers_maiden_last": ""},
        }
        client, _generate = self._client(payload)
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            result = extract_with_gemini(
                self.crops, enabled=True, api_key="test-key", client=client
            )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "INCOMPLETE_REQUIRED_NAMES")

    def test_blank_father_is_valid(self):
        client, _generate = self._client()
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            result = extract_with_gemini(
                self.crops, enabled=True, api_key="test-key", client=client
            )
        self.assertTrue(result.success)

    def test_invalid_json_and_api_failure_are_sanitized(self):
        client, _generate = self._client()
        client.models.generate_content.return_value = SimpleNamespace(text="not-json")
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            invalid = extract_with_gemini(
                self.crops, enabled=True, api_key="test-key", client=client
            )
        self.assertEqual(invalid.error_code, "INVALID_JSON")

        client, _generate = self._client(side_effect=RuntimeError("private response"))
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            failed = extract_with_gemini(
                self.crops, enabled=True, api_key="test-key", client=client
            )
        self.assertEqual(failed.error_code, "API_ERROR")
        self.assertNotIn("private", repr(failed))

    def test_timeout_is_sanitized_for_worker_fallback(self):
        class SyntheticTimeoutError(Exception):
            pass

        client, _generate = self._client(side_effect=SyntheticTimeoutError("secret"))
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            result = extract_with_gemini(
                self.crops, enabled=True, api_key="test-key", client=client
            )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "TIMEOUT")
        self.assertNotIn("secret", repr(result))

    def test_disabled_does_not_load_sdk(self):
        with patch("extraction.gemini_birth_extractor._load_sdk") as load_sdk:
            result = extract_with_gemini(self.crops, enabled=False)
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "DISABLED")
        load_sdk.assert_not_called()

    def test_response_requires_exact_keys(self):
        invalid_fields = dict(self.fields)
        invalid_fields["unexpected"] = "value"
        client, _generate = self._client({
            "template_id": "psa_birth_v1",
            "fields": invalid_fields,
        })
        with patch(
            "extraction.gemini_birth_extractor._load_sdk",
            return_value=(SimpleNamespace(), self.types),
        ):
            result = extract_with_gemini(
                self.crops, enabled=True, api_key="test-key", client=client
            )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "INVALID_SCHEMA")
        self.assertEqual(set(FIELD_KEYS), set(self.fields))


if __name__ == "__main__":
    unittest.main()
