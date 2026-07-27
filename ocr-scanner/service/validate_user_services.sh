#!/usr/bin/env bash

set -u

worker_unit="smart-pdm-worker.service"
gui_unit="smart-pdm-gui.service"
unit_directory="$HOME/.config/systemd/user"

failure_count=0

check_equal() {
  name="$1"
  actual="$2"
  expected="$3"

  if [ "$actual" = "$expected" ]; then
    echo "$name=passed"
  else
    echo "$name=failed"
    echo "${name}_actual=$actual"
    echo "${name}_expected=$expected"
    failure_count=$((failure_count + 1))
  fi
}

for unit in "$worker_unit" "$gui_unit"; do
  if [ -f "$unit_directory/$unit" ]; then
    echo "unit_file_present_${unit}=true"
  else
    echo "unit_file_present_${unit}=false"
    failure_count=$((failure_count + 1))
  fi
done

if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze --user verify \
    "$unit_directory/$worker_unit" \
    "$unit_directory/$gui_unit"
  verify_status=$?

  if [ "$verify_status" -eq 0 ]; then
    echo "systemd_unit_verification=passed"
  else
    echo "systemd_unit_verification=failed"
    failure_count=$((failure_count + 1))
  fi
fi

check_equal \
  "worker_enabled" \
  "$(systemctl --user is-enabled "$worker_unit" 2>/dev/null || true)" \
  "enabled"

check_equal \
  "gui_enabled" \
  "$(systemctl --user is-enabled "$gui_unit" 2>/dev/null || true)" \
  "enabled"

check_equal \
  "worker_restart_policy" \
  "$(systemctl --user show "$worker_unit" -p Restart --value 2>/dev/null || true)" \
  "on-failure"

check_equal \
  "gui_restart_policy" \
  "$(systemctl --user show "$gui_unit" -p Restart --value 2>/dev/null || true)" \
  "on-failure"

if grep -Rqs "network-online.target" \
  "$unit_directory/$worker_unit" \
  "$unit_directory/$gui_unit"
then
  echo "network_startup_dependency=failed"
  failure_count=$((failure_count + 1))
else
  echo "network_startup_dependency=passed"
fi

echo "worker_active=$(systemctl --user is-active "$worker_unit" 2>/dev/null || true)"
echo "gui_active=$(systemctl --user is-active "$gui_unit" 2>/dev/null || true)"
echo "desktop_display_socket=$([ -S /tmp/.X11-unix/X0 ] && echo ready || echo unavailable)"
echo "xauthority_file=$([ -f "$HOME/.Xauthority" ] && echo ready || echo unavailable)"

if [ "$failure_count" -eq 0 ]; then
  echo "user_service_validation=passed"
else
  echo "user_service_validation=failed"
  echo "failure_count=$failure_count"
  exit 1
fi
