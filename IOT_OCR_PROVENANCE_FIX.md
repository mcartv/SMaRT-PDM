# IoT OCR request, provenance, immutable snapshot, and Pi speed fix

## Corrected root causes

The deployed log `OCR snapshot content and provenance are immutable.` is raised
while the backend updates an existing `ocr_extracted_documents` row. The
snapshot table is append-only, so a new OCR result must insert a new immutable
snapshot and the Admin must read the latest snapshot for each document.

A second issue exists in the Pi identity path: the legacy default `pi-001` is
not a UUID. The backend and Pi now require or derive a stable UUID device ID.

The Pi latency was also caused by repeated full-page Tesseract passes for
Certificate of Indigency and expensive spell-correction candidates for noisy
Grade Form OCR. Fast review mode uses one bounded whole-page pass, one
Indigency detection pass, positional extraction first, and bounded crop
fallbacks.

Normal empty polling returns HTTP 404 and is no longer logged as a controller
error.

## Deployment

The backend applies the idempotent schema compatibility migration on the first
IoT OCR create, claim, or completion request after deployment.

The Pi worker startup log must include a UUID:

```text
Starting Pi IoT OCR worker | poll=1s | mode=interactive | device=<uuid>
```

The backend health endpoint exposes:

```json
{"iot_ocr_fix":"immutable-snapshot-provenance-v2"}
```
