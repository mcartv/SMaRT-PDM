#!/usr/bin/env bash

set -euo pipefail

project_root="${SMART_PDM_PROJECT_ROOT:-/home/smart_pdm/birth-certificate-acceptance/ocr/scanner}"
launcher="$project_root/service/gui_session_launcher.py"

if [ ! -f "$launcher" ]; then
  echo "gui_service_ready=false"
  echo "reason=launcher_unavailable"
  exit 1
fi

exec /usr/bin/python3 -u "$launcher"
