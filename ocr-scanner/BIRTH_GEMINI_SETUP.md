# Birth-only Gemini setup

Gemini supplements only PSA Birth Certificate Items 1, 6, and 13. Grade Form
and Indigency continue using their existing local Tesseract pipelines.

## Configure the Pi

1. Revoke any API key that has appeared in chat, source, logs, or screenshots.
2. Create a fresh Gemini API key in Google AI Studio for the intended project.
3. Install the optional Birth dependency:

   ```bash
   python3 -m pip install --user --break-system-packages \
     -r ocr-scanner/requirements-birth-gemini.txt
   ```

4. Add these values to `ocr-scanner/.env` on the Pi only:

   ```dotenv
   USE_GEMINI=true
   GEMINI_API_KEY=your-new-key
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_TIMEOUT_SECONDS=20
   ```

5. Restart `ocr-start.service`.

Set `USE_GEMINI=false` to disable remote Birth extraction without uninstalling
the SDK. When disabled, unavailable, timed out, or invalid, the worker uses the
existing Birth Tesseract result.

## Privacy boundary

When enabled, the nine cropped name cells are sent inline to Google Gemini.
The complete certificate image, local paths, and Pi temporary files are not
sent through this integration. Review the Gemini tier's data terms before
enabling it. Gemini output remains an unverified candidate; admin confirmation
is always required.
