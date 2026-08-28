#!/usr/bin/env bash

set -u

project_root="${SMART_PDM_PROJECT_ROOT:-/home/smart_pdm/birth-certificate-acceptance/ocr/scanner}"
display_value="${DISPLAY:-:0}"
xauthority_file="${XAUTHORITY:-$HOME/.Xauthority}"
runtime_directory="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
wait_seconds="${SMART_PDM_DISPLAY_WAIT_SECONDS:-120}"
display_number="${display_value#:}"
display_number="${display_number%%.*}"
x11_socket="/tmp/.X11-unix/X${display_number}"
deadline=$((SECONDS + wait_seconds))

while true; do
  if \
    [ -f "$project_root/gui/app.py" ] && \
    [ -S "$x11_socket" ] && \
    [ -f "$xauthority_file" ]
  then
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "gui_service_ready=false"
    echo "reason=display_or_project_unavailable"
    exit 1
  fi
  sleep 2
done

if ! /usr/bin/python3 -c "import tkinter"; then
  echo "gui_service_ready=false"
  echo "reason=tkinter_unavailable"
  exit 1
fi

mkdir -p "$runtime_directory/smart_pdm"
chmod 700 "$runtime_directory/smart_pdm"
cd "$project_root" || exit 1

echo "gui_service_ready=true"
echo "network_startup_dependency=false"

exec env \
  -u WAYLAND_DISPLAY \
  DISPLAY="$display_value" \
  XAUTHORITY="$xauthority_file" \
  XDG_RUNTIME_DIR="$runtime_directory" \
  SMART_PDM_RUNTIME_DIRECTORY="$runtime_directory/smart_pdm" \
  SMART_PDM_DEVICE_STATE_PATH="$runtime_directory/smart_pdm/device_state.json" \
  PYTHONUNBUFFERED=1 \
  /usr/bin/python3 -m gui.app
