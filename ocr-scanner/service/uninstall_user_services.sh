#!/usr/bin/env bash

set -u

unit_directory="$HOME/.config/systemd/user"
worker_unit="smart-pdm-worker.service"
gui_unit="smart-pdm-gui.service"

systemctl --user disable --now "$worker_unit" "$gui_unit" 2>/dev/null || true

rm -f \
  "$unit_directory/$worker_unit" \
  "$unit_directory/$gui_unit"

systemctl --user daemon-reload
systemctl --user reset-failed "$worker_unit" "$gui_unit" 2>/dev/null || true

echo "service_uninstallation=passed"
echo "source_launchers_removed=false"
echo "project_runtime_removed=false"
