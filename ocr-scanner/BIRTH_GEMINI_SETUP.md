# Birth OCR V1/V2 setup

Birth requests are explicitly versioned before extraction.

- `v1` runs the existing registered nine-cell Tesseract pipeline locally on the Pi.
- `v2` registers and crops locally, uploads one capture plus nine cells to the private
  `iot-ocr-captures` Supabase Storage bucket, and waits for backend Gemini extraction.

The Pi must not contain `GEMINI_API_KEY`. Configure these only on the backend:

```text
GEMINI_API_KEY=<new backend-only key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=45000
GEMINI_DIAGNOSTIC_TIMEOUT_MS=90000
IOT_OCR_CAPTURE_BUCKET=iot-ocr-captures
```

The Pi completion request must outlive both bounded backend Gemini stages:

```text
BIRTH_V2_COMPLETION_TIMEOUT_SECONDS=180
```

The backend service-role client creates signed upload authorizations scoped to an
individual request and artifact. The bucket is private. Candidate JSON, realtime
events, and logs never include the bucket, object path, upload token, or image bytes.

V2 does not run Tesseract or Gemini on the Pi and never falls back to V1. If Gemini
or deterministic validation fails, the candidate remains diagnostic-only and the
admin must Reject or Request Rescan. Successful confirmation, rejection, and rescan
mark private artifacts for deletion and retain the immutable candidate and review event.
