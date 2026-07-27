#!/usr/bin/env bash

set -u

service_source="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_directory="$HOME/.config/systemd/user"

worker_unit="smart-pdm-worker.service"
gui_unit="smart-pdm-gui.service"

if [ "$(id -u)" -eq 0 ]; then
  echo "service_installation=failed"
  echo "reason=run_as_smart_pdm_not_root"
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "service_installation=failed"
  echo "reason=systemctl_unavailable"
  exit 1
fi

required_files=(
  "$service_source/start_worker_service.sh"
  "$service_source/start_gui_service.sh"
  "$service_source/$worker_unit"
  "$service_source/$gui_unit"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "service_installation=failed"
    echo "missing_file=$file"
    exit 1
  fi
done

chmod 700 \
  "$service_source/start_worker_service.sh" \
  "$service_source/start_gui_service.sh"

mkdir -p "$unit_directory"
chmod 700 "$HOME/.config" "$HOME/.config/systemd" "$unit_directory" 2>/dev/null || true

install -m 600 "$service_source/$worker_unit" "$unit_directory/$worker_unit"
install -m 600 "$service_source/$gui_unit" "$unit_directory/$gui_unit"

systemctl --user daemon-reload

systemctl --user enable "$worker_unit" "$gui_unit"

enable_status=$?

if [ "$enable_status" -ne 0 ]; then
  echo "service_installation=failed"
  echo "reason=enable_failed"
  exit "$enable_status"
fi

services_started_now=false

if [ -S /tmp/.X11-unix/X0 ] && [ -f "$HOME/.Xauthority" ]; then
  systemctl --user restart "$worker_unit" "$gui_unit"
  restart_status=$?

  if [ "$restart_status" -ne 0 ]; then
    echo "service_installation=failed"
    echo "reason=restart_failed"
    exit "$restart_status"
  fi

  services_started_now=true
fi

echo "service_installation=passed"
echo "worker_enabled=$(systemctl --user is-enabled "$worker_unit" 2>/dev/null || true)"
echo "gui_enabled=$(systemctl --user is-enabled "$gui_unit" 2>/dev/null || true)"
echo "services_started_now=$services_started_now"
echo "network_startup_dependency=false"
echo "linger_required=false"
