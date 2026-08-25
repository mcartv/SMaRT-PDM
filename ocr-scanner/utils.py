"""
ui_lcd.py - Display driver for 7x5 inch non-touch LCD
Fixed: Better error handling
"""

import os
import time
from PIL import Image, ImageDraw, ImageFont

class LCDDisplay:
    def __init__(self):
        self.width = 800
        self.height = 480
        self.use_framebuffer = False
        self.fb_device = "/dev/fb0"
        
        try:
            if os.path.exists(self.fb_device):
                os.system(f"sudo chmod 666 {self.fb_device} 2>/dev/null")
                # Test write
                test_fb = open(self.fb_device, 'wb')
                test_fb.close()
                self.use_framebuffer = True
                print(f"✅ LCD Display ready: {self.width}x{self.height}")
            else:
                print("⚠️ Framebuffer not found")
        except Exception as e:
            print(f"⚠️ LCD error: {e}")
        
        self.image = Image.new('RGB', (self.width, self.height), color='black')
        self.draw = ImageDraw.Draw(self.image)
        
        try:
            self.font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
            self.font_normal = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
            self.font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            self.font_title = ImageFont.load_default()
            self.font_normal = ImageFont.load_default()
            self.font_small = ImageFont.load_default()
    
    def update(self):
        if self.use_framebuffer:
            try:
                with open(self.fb_device, 'wb') as fb:
                    fb.write(self.image.tobytes())
            except:
                pass
    
    def clear(self):
        self.image = Image.new('RGB', (self.width, self.height), color='black')
        self.draw = ImageDraw.Draw(self.image)
        self.update()
    
    def draw_centered(self, text, y, color='white', font=None):
        if font is None:
            font = self.font_normal
        try:
            bbox = self.draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            x = (self.width - text_width) // 2
            self.draw.text((x, y), text, fill=color, font=font)
        except:
            self.draw.text((self.width//2 - 100, y), text, fill=color, font=font)
    
    def show_ready(self):
        self.clear()
        self.draw_centered("📄 OCR SCANNER", 80, color='cyan', font=self.font_title)
        self.draw_centered("Ready to Scan", 180, color='green', font=self.font_normal)
        self.draw_centered("LEFT → Start", 300, color='white', font=self.font_normal)
        self.draw_centered("RIGHT → Exit", 360, color='red', font=self.font_normal)
        self.update()
    
    def show_preview(self):
        self.clear()
        preview_w, preview_h = 640, 360
        preview_x = (self.width - preview_w) // 2
        preview_y = 50
        self.draw.rectangle([preview_x, preview_y, preview_x + preview_w, preview_y + preview_h], outline='white', width=3)
        self.draw_centered("CAMERA PREVIEW", preview_y + 150, color='gray')
        self.draw_centered("LEFT → Capture", preview_y + preview_h + 60, color='cyan')
        self.draw_centered("RIGHT → Back", preview_y + preview_h + 100, color='red')
        self.update()
    
    def show_capture_confirm(self):
        self.clear()
        self.draw_centered("📸 CAPTURED!", 120, color='green', font=self.font_title)
        self.draw_centered("LEFT → OCR", 320, color='cyan')
        self.draw_centered("RIGHT → Retake", 380, color='red')
        self.update()
    
    def show_ocr_results(self, text, word_count):
        self.clear()
        self.draw_centered("📝 OCR RESULTS", 40, color='green', font=self.font_title)
        self.draw_centered(f"Words: {word_count}", 100, color='cyan')
        
        lines = text.split('\n')[:6]
        y = 160
        for line in lines:
            if len(line) > 40:
                line = line[:37] + "..."
            self.draw_centered(line, y, color='white', font=self.font_small)
            y += 35
        
        self.draw_centered("LEFT → Save & New", 400, color='cyan')
        self.draw_centered("RIGHT → Discard", 440, color='red')
        self.update()
    
    def show_loading(self, message):
        self.clear()
        self.draw_centered("⏳", 200, color='yellow', font=self.font_title)
        self.draw_centered(message, 280, color='white')
        self.update()
    
    def show_error(self, message):
        self.clear()
        self.draw_centered("❌ ERROR", 150, color='red', font=self.font_title)
        self.draw_centered(message[:35], 250, color='white')
        self.draw_centered("Press any button", 380, color='gray')
        self.update()
        time.sleep(2)
    
    def show_success(self, message):
        self.clear()
        self.draw_centered("✅ SUCCESS", 150, color='green', font=self.font_title)
        self.draw_centered(message[:35], 250, color='white')
        self.update()
        time.sleep(1.5)
    
    def show_menu(self, scan_count, api_enabled):
        self.clear()
        self.draw_centered("📋 SETTINGS", 50, color='cyan', font=self.font_title)
        self.draw_centered(f"Scans: {scan_count}", 140, color='white')
        self.draw_centered(f"API: {'ON' if api_enabled else 'OFF'}", 190, color='white')
        self.draw_centered("LEFT → Toggle API", 300, color='cyan')
        self.draw_centered("RIGHT → Close", 360, color='red')
        self.update()
    
    def cleanup(self):
        self.clear()
        print("📺 LCD cleanup complete")
