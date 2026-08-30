#!/usr/bin/env bash

set -euo pipefail

# This script is launched by the desktop's XDG autostart mechanism. Importing
# the real display/session variables into the user systemd manager makes the
# GUI service reliable on both X11/XWayland and Wayland Raspberry Pi desktops.
variables=()
for name in DISPLAY WAYLAND_DISPLAY XAUTHORITY XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS; do
  if [ -n "${!name:-}" ]; then
    variables+=("$name")
  fi
done

if [ "${#variables[@]}" -gt 0 ]; then
  systemctl --user import-environment "${variables[@]}" || true
fi

systemctl --user start smart-pdm-gui-state.service
systemctl --user restart smart-pdm-gui.service
