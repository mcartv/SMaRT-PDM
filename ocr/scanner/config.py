"""
config.py - Configuration for OCR Scanner
"""

import os
import glob

# Button codes for USB Mouse
BUTTON_LEFT = 272    # BTN_LEFT (mouse left button)
BUTTON_RIGHT = 273   # BTN_RIGHT (mouse right button)
DEBOUNCE_MS = 200    # Debounce time in milliseconds

# Force specific event device - USING YOUR USB OPTICAL MOUSE
EVENT_NUMBER = 4  # event6 is your USB OPTICAL MOUSE

def find_mouse_device():
    """Use specific event device"""
    device_path = f"/dev/input/event{EVENT_NUMBER}"
    
    if os.path.exists(device_path):
        print(f"🔍 Using device: {device_path}")
        return device_path
    else:
        print(f"❌ Device {device_path} not found!")
        return None

# Automatically find the mouse device
INPUT_DEVICE = find_mouse_device()

if INPUT_DEVICE is None:
    print("❌ No mouse found! Please check USB connection.")
else:
    print(f"✅ Using input device: {INPUT_DEVICE}")

# OCR Configuration
OCR_LANGUAGE = 'eng'
OCR_TIMEOUT = 5

# Camera Configuration
CAMERA_RESOLUTION = (1920, 1080)
CAMERA_FRAMERATE = 30

# Display Configuration
DISPLAY_ROTATION = 0


