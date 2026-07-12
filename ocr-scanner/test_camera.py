#!/usr/bin/env python3
"""
test_camera.py - Test camera with rpicam commands
"""

import os
import subprocess
import time

print("=" * 60)
print(" CAMERA DEBUG TEST (rpicam)")
print("=" * 60)

# Check environment
print(f"\n📋 Environment:")
print(f"   DISPLAY = {os.environ.get('DISPLAY', 'NOT SET')}")

# Check camera
print(f"\n📷 Camera Check:")
result = subprocess.run("rpicam-still --list-cameras 2>&1", 
                       shell=True, capture_output=True, text=True)
if "imx708" in result.stdout or "Available cameras" in result.stdout:
    print("   ✅ Camera detected!")
    print(f"   {result.stdout.strip()[:200]}")
else:
    print("   ❌ No camera detected")

# Kill existing processes
print(f"\n🧹 Cleaning up...")
subprocess.run("sudo killall -9 rpicam-still rpicam-hello 2>/dev/null", shell=True)
time.sleep(1)

# Test capture
print(f"\n📸 Testing capture...")
cmd = "rpicam-still -o /tmp/test_capture.jpg --width 2592 --height 1944 --quality 95 -t 1000 -n"
print(f"   Command: {cmd}")

result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)

if os.path.exists("/tmp/test_capture.jpg"):
    size = os.path.getsize("/tmp/test_capture.jpg")
    print(f"   ✅ Captured! Size: {size} bytes ({size//1024} KB)")
    
    # Test OCR on the captured image
    print(f"\n🔍 Testing OCR extraction...")
    try:
        from ocr import extract_text
        text = extract_text("/tmp/test_capture.jpg")
        if text:
            print(f"   ✅ OCR successful! {len(text.split())} words extracted")
            print(f"\n📝 Preview:")
            print("-" * 40)
            lines = text.split('\n')[:10]
            for line in lines:
                if line.strip():
                    print(f"   {line[:70]}")
            if len(text.split('\n')) > 10:
                print("   ...")
            
            # Save to file
            with open("/tmp/test_ocr_result.txt", "w") as f:
                f.write(text)
            print(f"\n   ✅ Saved to /tmp/test_ocr_result.txt")
        else:
            print("   ⚠️ No text extracted")
    except Exception as e:
        print(f"   ❌ OCR error: {e}")
else:
    print(f"   ❌ Capture failed")
    if result.stderr:
        print(f"   Error: {result.stderr[:300]}")

# Test preview
print(f"\n📹 Testing preview (will run for 3 seconds)...")
print("   You should see a preview window on HDMI")

proc = subprocess.Popen(
    "rpicam-hello -t 3000",
    shell=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

time.sleep(3)
proc.terminate()
subprocess.run("sudo killall -9 rpicam-hello 2>/dev/null", shell=True)
print("   ✅ Preview test complete")

print("\n" + "=" * 60)
print(" DEBUG COMPLETE")
print("=" * 60)
print("\n📄 Check results:")
print("   cat /tmp/test_ocr_result.txt")
