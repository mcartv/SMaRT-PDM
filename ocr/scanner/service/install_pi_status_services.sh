#!/usr/bin/env bash

set -u

service_source="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_directory="$HOME/.config/systemd/user"
units=(smart-pdm-gui-state.service smart-pdm-gui.service)

if [ "$(id -u)" -eq 0 ]; then
  echo "service_installation=failed"
  echo "reason=run_as_smart_pdm_not_root"
  exit 1
fi

for required in \
  "$service_source/start_gui_service.sh" \
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

chmod 700 "$service_source/start_gui_service.sh"
mkdir -p "$unit_directory"
for unit in "${units[@]}"; do
  install -m 600 "$service_source/$unit" "$unit_directory/$unit"
done

systemctl --user daemon-reload
systemctl --user enable "${units[@]}"

echo "service_installation=passed"
echo "network_startup_dependency=false"
echo "restart_command=systemctl --user restart ${units[*]}"
