#!/usr/bin/env bash

set -u

project_root="${SMART_PDM_PROJECT_ROOT:-/home/smart_pdm/worker_integration_acceptance}"
display_value="${DISPLAY:-:0}"
xauthority_file="${XAUTHORITY:-$HOME/.Xauthority}"
runtime_directory="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
state_file="${SMART_PDM_OCR_STATE_PATH:-$runtime_directory/smart_pdm/ocr_state.json}"
wait_seconds="${SMART_PDM_DISPLAY_WAIT_SECONDS:-120}"

display_number="${display_value#:}"
display_number="${display_number%%.*}"
x11_socket="/tmp/.X11-unix/X${display_number}"

deadline=$((SECONDS + wait_seconds))

while true; do
  project_ready=false
  display_ready=false
  authority_ready=false

  if [ -d "$project_root" ] && [ -f "$project_root/gui/app.py" ]; then
    project_ready=true
  fi

  if [ -S "$x11_socket" ]; then
    display_ready=true
  fi

  if [ -f "$xauthority_file" ]; then
    authority_ready=true
  fi

  if \
    [ "$project_ready" = "true" ] &&
    [ "$display_ready" = "true" ] &&
    [ "$authority_ready" = "true" ]
  then
    break
  fi

  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "gui_service_ready=false"
    echo "project_ready=$project_ready"
    echo "display_ready=$display_ready"
    echo "authority_ready=$authority_ready"
    exit 1
  fi

  sleep 2
done

if ! /usr/bin/python3 - <<'PY'
try:
    import tkinter
except Exception:
    raise SystemExit(1)
raise SystemExit(0)
PY
then
  echo "gui_service_ready=false"
  echo "reason=tkinter_unavailable"
  exit 1
fi

mkdir -p "$runtime_directory/smart_pdm"
chmod 700 "$runtime_directory/smart_pdm"

cd "$project_root" || {
  echo "gui_service_ready=false"
  echo "reason=project_directory_unavailable"
  exit 1
}

echo "gui_service_ready=true"
echo "display=$display_value"
echo "state_file=$state_file"
echo "network_startup_dependency=false"
echo "starting_gui=true"

exec env \
  -u WAYLAND_DISPLAY \
  DISPLAY="$display_value" \
  XAUTHORITY="$xauthority_file" \
  XDG_RUNTIME_DIR="$runtime_directory" \
  SMART_PDM_OCR_STATE_PATH="$state_file" \
  PYTHONUNBUFFERED=1 \
  /usr/bin/python3 -m gui.app
