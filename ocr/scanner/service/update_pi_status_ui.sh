#!/usr/bin/env bash

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "pi_update=failed"
  echo "reason=run_as_smart_pdm_not_root"
  exit 1
fi

service_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scanner_directory="$(cd "$service_directory/.." && pwd)"
repository_root="$(git -C "$scanner_directory" rev-parse --show-toplevel)"
current_branch="$(git -C "$repository_root" branch --show-current)"

if [ "$current_branch" != "main" ]; then
  echo "pi_update=failed"
  echo "reason=main_branch_required"
  echo "current_branch=$current_branch"
  exit 1
fi

if [ -n "$(git -C "$repository_root" status --porcelain --untracked-files=no)" ]; then
  echo "pi_update=failed"
  echo "reason=tracked_worktree_changes"
  exit 1
fi

echo "pi_update_stage=fetch_main"
git -C "$repository_root" fetch origin main
git -C "$repository_root" merge --ff-only origin/main

if [ ! -f "$scanner_directory/.env" ]; then
  echo "pi_update=failed"
  echo "reason=pi_environment_missing"
  echo "expected=$scanner_directory/.env"
  exit 1
fi

echo "pi_update_stage=validate_configuration"
(
  cd "$scanner_directory"
  /usr/bin/python3 - <<'PY'
from service.active_worker_gui_state import load_probe_config

configuration = load_probe_config()
print("probe_configuration=valid")
print(f"probe_interval_seconds={configuration.interval_seconds:g}")
print(f"probe_timeout_seconds={configuration.timeout_seconds:g}")
PY
)

chmod 700 \
  "$scanner_directory/service/install_pi_status_services.sh" \
  "$scanner_directory/service/start_gui_service.sh" \
  "$scanner_directory/service/update_pi_status_ui.sh"

echo "pi_update_stage=install_services"
bash "$scanner_directory/service/install_pi_status_services.sh"

echo "pi_update_stage=restart_status_services"
systemctl --user restart smart-pdm-gui-state.service smart-pdm-gui.service

if systemctl list-unit-files ocr-start.service >/dev/null 2>&1; then
  echo "pi_update_stage=restart_ocr_worker"
  sudo systemctl restart ocr-start.service
fi

systemctl --user is-active --quiet smart-pdm-gui-state.service
systemctl --user is-active --quiet smart-pdm-gui.service

echo "pi_update=passed"
echo "revision=$(git -C "$repository_root" rev-parse --short HEAD)"
echo "next=run_physical_acceptance_from_docs/pi_status_gui.md"
