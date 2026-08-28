# Raspberry Pi Realtime Status GUI

The touchscreen is read-only. It never claims OCR requests, controls the camera,
or changes extraction behavior. Its top badge represents public Internet access
only; SMaRT-PDM and OCR Worker are independent status rows.

## Configuration

Add two distinct, lightweight HTTPS endpoints to `ocr/scanner/.env`:

```env
PUBLIC_INTERNET_PROBE_URL_1=https://your-first-probe.example/health
PUBLIC_INTERNET_PROBE_URL_2=https://your-second-probe.example/health
PUBLIC_INTERNET_PROBE_INTERVAL_SECONDS=5
PUBLIC_INTERNET_PROBE_TIMEOUT_SECONDS=2
SMART_PDM_WORKER_HEARTBEAT_SECONDS=2.5
SMART_PDM_WORKER_STALE_SECONDS=7.5
SMART_PDM_DEVICE_HEARTBEAT_SECONDS=2.5
```

Neither public probe may be the configured `RENDER_API_BASE_URL`. The monitor
accepts one successful public probe as Online and requires both to fail before
showing Offline. The backend row uses `RENDER_API_BASE_URL/api/health` separately.

## Installation

Run as the `smart_pdm` desktop user, not root:

```bash
cd /home/smart_pdm/birth-certificate-acceptance/ocr/scanner
bash ./service/install_pi_status_services.sh
systemctl --user restart smart-pdm-gui-state.service smart-pdm-gui.service
```

For later updates after this feature is present on `main`, run from the Pi's
existing repository checkout:

```bash
bash ocr/scanner/service/update_pi_status_ui.sh
```

The updater requires a clean tracked checkout on `main`, pulls with a
fast-forward-only merge, validates the two probe URLs, installs/restarts the GUI
services, and restarts `ocr-start.service` when that system unit exists. It never
overwrites the ignored Pi `.env` file.

Inspect status without exposing request data:

```bash
systemctl --user status smart-pdm-gui-state.service smart-pdm-gui.service
journalctl --user -u smart-pdm-gui-state.service -u smart-pdm-gui.service -n 100
```

## Physical acceptance

1. With Internet and the backend available, confirm `ONLINE`, `Connected`, and
   `Ready`.
2. Disconnect Internet. Within the next five-second probe, confirm `OFFLINE` and
   `No Internet`; the fresh local worker must remain `Ready` or `Busy`.
3. Restore Internet and confirm both network states recover without restarting
   the GUI.
4. Stop `ocr-start.service`; after the local heartbeat expires, confirm OCR
   Worker becomes `Offline` while Internet and SMaRT-PDM remain unchanged.
5. Restart the worker and run one real OCR request. Confirm the activity sequence
   updates without waiting for the network-probe interval: Request received,
   Ready to capture, Capturing document, Processing document, Sending result,
   and Completed or Processing failed.
6. At the actual display resolution, inspect every visible string. Nothing may
   wrap or change font size; constrained text must end in an ellipsis.

Deployment and physical acceptance are intentionally separate from automated
desktop tests because they require the configured Pi, display, camera, buttons,
Wi-Fi control, and production service manager.
