#!/usr/bin/env bash

set -euo pipefail

service_source="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_directory="$HOME/.config/systemd/user"
autostart_directory="$HOME/.config/autostart"
units=(smart-pdm-gui-state.service smart-pdm-gui.service)

if [ "$(id -u)" -eq 0 ]; then
  echo "service_installation=failed"
  echo "reason=run_as_smart_pdm_not_root"
  exit 1
fi

for required in \
  "$service_source/start_gui_service.sh" \
  "$service_source/start_gui_on_desktop.sh" \
  "$service_source/gui_session_launcher.py" \
  "$service_source/smart-pdm-gui.desktop" \
  "$service_source/active_worker_gui_state.py" \
  "$service_source/${units[0]}" \
  "$service_source/${units[1]}"
do
  if [ ! -f "$required" ]; then
    echo "service_installation=failed"
    echo "missing_file=$required"
    exit 1
  fi
done

chmod 700 \
  "$service_source/start_gui_service.sh" \
  "$service_source/start_gui_on_desktop.sh" \
  "$service_source/gui_session_launcher.py"

mkdir -p "$unit_directory" "$autostart_directory"
for unit in "${units[@]}"; do
  install -m 600 "$service_source/$unit" "$unit_directory/$unit"
done
install -m 644 \
  "$service_source/smart-pdm-gui.desktop" \
  "$autostart_directory/smart-pdm-gui.desktop"

systemctl --user daemon-reload
systemctl --user enable "${units[@]}"

# Start the monitor immediately. The GUI launcher will wait for a real desktop
# session if installation is performed before the display is ready.
systemctl --user restart smart-pdm-gui-state.service
systemctl --user restart smart-pdm-gui.service

echo "service_installation=passed"
echo "desktop_autostart=installed"
echo "network_startup_dependency=false"
echo "restart_command=systemctl --user restart ${units[*]}"
