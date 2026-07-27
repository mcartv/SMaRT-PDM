#!/usr/bin/env bash

set -u

project_root="/home/smart_pdm/worker_integration_acceptance"
x11_socket="/tmp/.X11-unix/X0"
xauthority_file="$HOME/.Xauthority"
runtime_directory="/run/user/$(id -u)"
state_file="$runtime_directory/smart_pdm/ocr_state.json"

if [ ! -d "$project_root" ]; then
  echo "gui_started=false"
  echo "reason=project_directory_unavailable"
  exit 1
fi

if [ ! -S "$x11_socket" ]; then
  echo "gui_started=false"
  echo "reason=x11_display_unavailable"
  exit 1
fi

if [ ! -f "$xauthority_file" ]; then
  echo "gui_started=false"
  echo "reason=xauthority_unavailable"
  exit 1
fi

if ! python3 - <<'PY'
try:
    import tkinter
except Exception:
    raise SystemExit(1)
raise SystemExit(0)
PY
then
  echo "gui_started=false"
  echo "reason=tkinter_unavailable"
  exit 1
fi

cd "$project_root" || exit 1

for pid in $(pgrep -f '[p]ython3 -m gui.app' 2>/dev/null || true); do
  process_directory="$(
    readlink -f "/proc/$pid/cwd" 2>/dev/null ||
    true
  )"

  if [ "$process_directory" = "$project_root" ]; then
    echo "stopping_existing_gui_pid=$pid"
    kill "$pid" 2>/dev/null || true
  fi
done

sleep 1

echo "gui_display_environment=ready"
echo "display=:0"
echo "state_file=$state_file"
echo "starting_read_only_gui=true"

exec env \
  -u WAYLAND_DISPLAY \
  DISPLAY=:0 \
  XAUTHORITY="$xauthority_file" \
  XDG_RUNTIME_DIR="$runtime_directory" \
  SMART_PDM_OCR_STATE_PATH="$state_file" \
  python3 -m gui.app
