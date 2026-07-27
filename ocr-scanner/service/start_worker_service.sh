#!/usr/bin/env bash

set -u

project_root="${SMART_PDM_PROJECT_ROOT:-/home/smart_pdm/worker_integration_acceptance}"
display_value="${DISPLAY:-:0}"
xauthority_file="${XAUTHORITY:-$HOME/.Xauthority}"
runtime_directory="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
wait_seconds="${SMART_PDM_DISPLAY_WAIT_SECONDS:-120}"

display_number="${display_value#:}"
display_number="${display_number%%.*}"
x11_socket="/tmp/.X11-unix/X${display_number}"

deadline=$((SECONDS + wait_seconds))

while true; do
  project_ready=false
  display_ready=false
  authority_ready=false

  if [ -d "$project_root" ] && [ -f "$project_root/job_worker.py" ]; then
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
    echo "worker_service_ready=false"
    echo "project_ready=$project_ready"
    echo "display_ready=$display_ready"
    echo "authority_ready=$authority_ready"
    exit 1
  fi

  sleep 2
done

if [ ! -f "$project_root/.env" ]; then
  echo "worker_service_ready=false"
  echo "reason=environment_file_missing"
  exit 1
fi

if ! grep -q '^RENDER_API_BASE_URL=' "$project_root/.env"; then
  echo "worker_service_ready=false"
  echo "reason=required_environment_variable_missing"
  exit 1
fi

mkdir -p "$runtime_directory/smart_pdm"
chmod 700 "$runtime_directory/smart_pdm"

cd "$project_root" || {
  echo "worker_service_ready=false"
  echo "reason=project_directory_unavailable"
  exit 1
}

echo "worker_service_ready=true"
echo "display=$display_value"
echo "network_startup_dependency=false"
echo "starting_worker=true"

exec env \
  -u WAYLAND_DISPLAY \
  DISPLAY="$display_value" \
  XAUTHORITY="$xauthority_file" \
  XDG_RUNTIME_DIR="$runtime_directory" \
  PYTHONUNBUFFERED=1 \
  /usr/bin/python3 -u job_worker.py
