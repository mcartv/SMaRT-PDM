"""
camera.py - Camera handling based on scan.py
"""

import os
import subprocess
import time
import signal


class CameraController:
    def __init__(self):
        self.preview_process = None
        self.is_previewing = False
        self.capture_file = "/tmp/raw_capture.jpg"
        self.capture_width = 2592
        self.capture_height = 1944
        self.capture_quality = 95

    def clear_hardware(self):
        subprocess.run(
            "sudo killall -9 rpicam-vid rpicam-still rpicam-hello 2>/dev/null",
            shell=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL
        )
        time.sleep(0.5)

    def check_available(self):
        result = subprocess.run(
            "rpicam-still --list-cameras 2>&1 | head -5",
            shell=True, capture_output=True, text=True
        )
        if "No cameras" in result.stdout or result.returncode != 0:
            print("No camera detected.")
            return False
        print("Camera detected.")
        return True

    def start_preview(self):
        self.clear_hardware()
        print("Starting preview on HDMI...")

        cmd = "rpicam-hello -t 0"
        self.preview_process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
        time.sleep(2)

        if self.preview_process.poll() is None:
            self.is_previewing = True
            print("Preview active")
            return True
        return False

    def stop_preview(self):
        if self.preview_process and self.preview_process.poll() is None:
            try:
                os.killpg(os.getpgid(self.preview_process.pid), signal.SIGTERM)
                self.preview_process.wait(timeout=3)
            except Exception:
                try:
                    self.preview_process.kill()
                except Exception:
                    pass
            self.preview_process = None

        self.clear_hardware()
        self.is_previewing = False
        time.sleep(1)

    def capture_image(self, *, restart_preview=True):
        was_previewing = self.is_previewing

        print("\nStopping preview...")
        self.stop_preview()

        print(f"Capturing at {self.capture_width}x{self.capture_height}...")

        if os.path.exists(self.capture_file):
            os.remove(self.capture_file)

        result = subprocess.run(
            f"rpicam-still -o {self.capture_file} "
            f"--width {self.capture_width} --height {self.capture_height} "
            f"--quality {self.capture_quality} "
            f"-t 2000 "
            f"--autofocus-mode continuous "
            f"--awb auto "
            f"--denoise cdn_off",
            shell=True,
            capture_output=True, text=True
        )

        if result.returncode != 0 or not os.path.exists(self.capture_file):
            print(f"Capture failed:\n{result.stderr}")
            if was_previewing and restart_preview:
                self.start_preview()
            return False

        size_kb = os.path.getsize(self.capture_file) // 1024
        print(f"Captured ({size_kb} KB) -> {self.capture_file}")

        if was_previewing and restart_preview:
            print("Restarting preview...")
            self.start_preview()

        return True

    def cleanup(self):
        self.stop_preview()
        self.clear_hardware()
