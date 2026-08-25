"""
buttons.py - Reliable 2-button controller with proper debouncing
"""

import threading
import time
import struct
import os
import fcntl
from config import BUTTON_LEFT, BUTTON_RIGHT, DEBOUNCE_MS, INPUT_DEVICE

class ButtonController:
    """Handles mouse button input with debouncing"""
    
    def __init__(self):
        self.confirm_callback = None
        self.cancel_callback = None
        self.menu_callback = None
        self.running = False
        self.thread = None
        self.device_file = None
        self.device_path = INPUT_DEVICE
        self._lock = threading.Lock()
        
        # Button state tracking
        self.last_confirm_time = 0
        self.last_cancel_time = 0
        self.confirm_pressed = False
        self.cancel_pressed = False
    
    def on_confirm(self, callback):
        """Set callback for confirm button (LEFT mouse button)"""
        self.confirm_callback = callback
    
    def on_cancel(self, callback):
        """Set callback for cancel button (RIGHT mouse button)"""
        self.cancel_callback = callback
    
    def on_menu(self, callback):
        """Set callback for menu (middle mouse button)"""
        self.menu_callback = callback
    
    def _setup_device(self):
        """Setup input device with non-blocking mode"""
        try:
            # Check if device exists
            if not os.path.exists(self.device_path):
                print(f"❌ Device {self.device_path} does not exist!")
                return False
            
            # Open device
            self.device_file = open(self.device_path, 'rb')
            
            # Set non-blocking mode
            flags = fcntl.fcntl(self.device_file.fileno(), fcntl.F_GETFL)
            fcntl.fcntl(self.device_file.fileno(), fcntl.F_SETFL, flags | os.O_NONBLOCK)
            
            print(f"✅ Button controller initialized on {self.device_path}")
            return True
        except PermissionError:
            print(f"❌ Permission denied for {self.device_path}")
            print(f"   Run: sudo chmod 666 {self.device_path}")
            return False
        except Exception as e:
            print(f"❌ Button device error: {e}")
            return False
    
    def _read_buttons(self):
        """Main button reading loop"""
        if not self._setup_device():
            print("❌ Cannot initialize button input")
            return
        
        self.running = True
        print("🎮 Button controller ready - Left=Confirm, Right=Cancel")
        
        while self.running:
            try:
                data = self.device_file.read(24)
                if len(data) == 24:
                    # Parse input event structure
                    (sec, usec, ev_type, ev_code, ev_value) = struct.unpack('llHHI', data)
                    
                    # EV_KEY = 1 (button events)
                    if ev_type == 1:
                        self._handle_button_event(ev_code, ev_value)
                        
            except BlockingIOError:
                # No data available - expected in non-blocking mode
                time.sleep(0.01)
            except Exception as e:
                # Silently handle other errors
                time.sleep(0.01)
    
    def _handle_button_event(self, code, value):
        """Process button events with debouncing"""
        current_time = time.time() * 1000
        
        with self._lock:
            # LEFT mouse button (Confirm) - code 272
            if code == 272:  # BTN_LEFT
                if value == 1:  # Press
                    self.confirm_pressed = True
                elif value == 0 and self.confirm_pressed:  # Release
                    self.confirm_pressed = False
                    if current_time - self.last_confirm_time > DEBOUNCE_MS:
                        self.last_confirm_time = current_time
                        print("🔴 CONFIRM pressed")
                        if self.confirm_callback:
                            threading.Thread(target=self.confirm_callback, daemon=True).start()
            
            # RIGHT mouse button (Cancel) - code 273
            elif code == 273:  # BTN_RIGHT
                if value == 1:  # Press
                    self.cancel_pressed = True
                elif value == 0 and self.cancel_pressed:  # Release
                    self.cancel_pressed = False
                    if current_time - self.last_cancel_time > DEBOUNCE_MS:
                        self.last_cancel_time = current_time
                        print("🔴 CANCEL pressed")
                        if self.cancel_callback:
                            threading.Thread(target=self.cancel_callback, daemon=True).start()
    
    def start(self):
        """Start button monitoring"""
        if not self.device_path:
            print("❌ No input device configured")
            return False
        
        self.thread = threading.Thread(target=self._read_buttons, daemon=True)
        self.thread.start()
        return True
    
    def stop(self):
        """Stop button monitoring"""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
    
    def cleanup(self):
        """Cleanup resources"""
        self.stop()
        if self.device_file:
            try:
                self.device_file.close()
            except:
                pass
        print("🎮 Button controller stopped")

