"""
display.py - LCD display driver for 7-inch screen
"""

import os
import time
from PIL import Image, ImageDraw, ImageFont
from config import LCD_WIDTH, LCD_HEIGHT, FB_DEVICE

class LCDDisplay:
    """Handles rendering to the LCD framebuffer"""
    
    def __init__(self):
        self.width = LCD_WIDTH
        self.height = LCD_HEIGHT
        self.use_framebuffer = False
        self.fb_device = FB_DEVICE
        
        # Initialize framebuffer
        try:
            if os.path.exists(self.fb_device):
                os.system(f"sudo chmod 666 {self.fb_device} 2>/dev/null")
                with open(self.fb_device, 'wb') as fb:
                    fb.write(b'\x00' * (self.width * self.height * 3))
                self.use_framebuffer = True
                print(f"✅ LCD Display ready: {self.width}x{self.height}")
            else:
                print(f"⚠️ Framebuffer {self.fb_device} not found")
        except Exception as e:
            print(f"⚠️ LCD init error: {e}")
        
        # Create image buffer
        self.image = Image.new('RGB', (self.width, self.height), color='black')
        self.draw = ImageDraw.Draw(self.image)
        
        # Load fonts
        self._load_fonts()
    
    def _load_fonts(self):
        """Load fonts with fallbacks"""
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
        
        try:
            self.font_large = ImageFont.truetype(font_paths[0], 48)
            self.font_medium = ImageFont.truetype(font_paths[1], 28)
            self.font_small = ImageFont.truetype(font_paths[1], 18)
        except:
            try:
                self.font_large = ImageFont.truetype(font_paths[2], 48)
                self.font_medium = ImageFont.truetype(font_paths[3], 28)
                self.font_small = ImageFont.truetype(font_paths[3], 18)
            except:
                self.font_large = ImageFont.load_default()
                self.font_medium = ImageFont.load_default()
                self.font_small = ImageFont.load_default()
    
    def update(self):
        """Write buffer to framebuffer"""
        if self.use_framebuffer:
            try:
                with open(self.fb_device, 'wb') as fb:
                    fb.write(self.image.tobytes())
            except Exception as e:
                pass
    
    def clear(self, color='black'):
        """Clear the display"""
        self.image = Image.new('RGB', (self.width, self.height), color=color)
        self.draw = ImageDraw.Draw(self.image)
        self.update()
    
    def draw_text_centered(self, text, y, color='white', font=None):
        """Draw centered text"""
        if font is None:
            font = self.font_medium
        
        try:
            bbox = self.draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            x = (self.width - text_width) // 2
            self.draw.text((x, y), text, fill=color, font=font)
        except:
            # Fallback for older PIL versions
            text_width = self.draw.textlength(text, font=font) if hasattr(self.draw, 'textlength') else len(text) * 20
            x = (self.width - text_width) // 2
            self.draw.text((x, y), text, fill=color, font=font)
    
    def draw_text_left(self, text, x, y, color='white', font=None):
        """Draw left-aligned text"""
        if font is None:
            font = self.font_medium
        self.draw.text((x, y), text, fill=color, font=font)
    
    def draw_rectangle(self, x1, y1, x2, y2, outline='white', fill=None, width=2):
        """Draw a rectangle"""
        self.draw.rectangle([x1, y1, x2, y2], outline=outline, fill=fill, width=width)
    
    def draw_line(self, x1, y1, x2, y2, fill='white', width=1):
        """Draw a line"""
        self.draw.line([x1, y1, x2, y2], fill=fill, width=width)
    
    # Screen layouts
    def show_ready(self, scan_count=0):
        """Show ready screen"""
        self.clear('black')
        self.draw_text_centered("📄 OCR SCANNER", 60, color='#00FFFF', font=self.font_large)
        self.draw_text_centered("Ready to Scan", 150, color='#00FF00', font=self.font_medium)
        self.draw_line(50, 220, self.width - 50, 220, fill='#333333', width=1)
        self.draw_text_centered(f"Scans: {scan_count}", 260, color='#888888', font=self.font_small)
        self.draw_text_centered("LEFT → Start Scan", 360, color='white', font=self.font_medium)
        self.draw_text_centered("RIGHT → Exit", 420, color='#FF6666', font=self.font_medium)
        self.update()
    
    def show_preview(self):
        """Show preview screen"""
        self.clear('black')
        preview_w, preview_h = 640, 360
        preview_x = (self.width - preview_w) // 2
        preview_y = 40
        
        self.draw_rectangle(preview_x, preview_y, 
                           preview_x + preview_w, preview_y + preview_h, 
                           outline='#444444', width=3)
        self.draw_text_centered("CAMERA PREVIEW", preview_y + preview_h // 2, 
                                color='#666666', font=self.font_medium)
        
        self.draw_text_centered("Position document and press", preview_y + preview_h + 40, 
                                color='white', font=self.font_small)
        self.draw_text_centered("LEFT → Capture", preview_y + preview_h + 80, 
                                color='#00FFFF', font=self.font_medium)
        self.draw_text_centered("RIGHT → Cancel", preview_y + preview_h + 120, 
                                color='#FF6666', font=self.font_medium)
        self.update()
    
    def show_capturing(self):
        """Show capturing screen"""
        self.clear('black')
        self.draw_text_centered("📸", 120, color='white', font=self.font_large)
        self.draw_text_centered("Capturing...", 220, color='#FFFF00', font=self.font_medium)
        self.draw_text_centered("Hold steady", 300, color='#888888', font=self.font_small)
        self.update()
    
    def show_processing(self, message="Processing..."):
        """Show processing screen"""
        self.clear('black')
        self.draw_text_centered("⏳", 150, color='#FFFF00', font=self.font_large)
        self.draw_text_centered(message, 260, color='white', font=self.font_medium)
        self.update()
    
    def show_ocr_results(self, text, word_count):
        """Show OCR results"""
        self.clear('black')
        self.draw_text_centered("📝 OCR RESULTS", 30, color='#00FF00', font=self.font_large)
        self.draw_text_centered(f"{word_count} words found", 90, color='#00FFFF', font=self.font_small)
        
        self.draw_line(40, 120, self.width - 40, 120, fill='#333333', width=1)
        
        # Show first few lines
        lines = text.split('\n')[:5]
        y = 150
        for line in lines:
            if line.strip():
                display_line = line[:45] + "..." if len(line) > 45 else line
                self.draw_text_left(display_line, 40, y, color='white', font=self.font_small)
                y += 35
        
        if len(text.split('\n')) > 5:
            self.draw_text_centered("...", y, color='#888888', font=self.font_small)
        
        self.draw_line(40, 370, self.width - 40, 370, fill='#333333', width=1)
        
        self.draw_text_centered("LEFT → Save & Continue", 400, color='#00FFFF', font=self.font_small)
        self.draw_text_centered("RIGHT → Discard", 445, color='#FF6666', font=self.font_small)
        self.update()
    
    def show_saving(self, filename=""):
        """Show saving screen"""
        self.clear('black')
        self.draw_text_centered("💾", 150, color='#00FF00', font=self.font_large)
        self.draw_text_centered("Saving...", 260, color='white', font=self.font_medium)
        if filename:
            self.draw_text_centered(filename, 320, color='#888888', font=self.font_small)
        self.update()
    
    def show_error(self, message):
        """Show error screen"""
        self.clear('black')
        self.draw_text_centered("❌", 120, color='#FF0000', font=self.font_large)
        self.draw_text_centered("Error", 200, color='#FF6666', font=self.font_medium)
        self.draw_text_centered(message[:40], 280, color='white', font=self.font_small)
        self.draw_text_centered("Press any button", 400, color='#888888', font=self.font_small)
        self.update()
    
    def show_success(self, message):
        """Show success screen briefly"""
        self.clear('black')
        self.draw_text_centered("✅", 150, color='#00FF00', font=self.font_large)
        self.draw_text_centered(message[:40], 280, color='white', font=self.font_medium)
        self.update()
    
    def show_menu(self, scan_count=0, api_enabled=False):
        """Show menu screen"""
        self.clear('black')
        self.draw_text_centered("📋 SETTINGS", 40, color='#00FFFF', font=self.font_large)
        
        self.draw_line(50, 100, self.width - 50, 100, fill='#333333', width=1)
        
        y = 140
        self.draw_text_left(f"Total Scans:", 60, y, color='#888888', font=self.font_medium)
        self.draw_text_left(f"{scan_count}", self.width - 150, y, color='white', font=self.font_medium)
        
        y += 60
        self.draw_text_left(f"API Upload:", 60, y, color='#888888', font=self.font_medium)
        api_status = "ON" if api_enabled else "OFF"
        api_color = '#00FF00' if api_enabled else '#FF6666'
        self.draw_text_left(api_status, self.width - 150, y, color=api_color, font=self.font_medium)
        
        self.draw_line(50, 280, self.width - 50, 280, fill='#333333', width=1)
        
        self.draw_text_centered("LEFT → Toggle API", 330, color='#00FFFF', font=self.font_small)
        self.draw_text_centered("RIGHT → Close", 380, color='#FF6666', font=self.font_small)
        self.update()
    
    def cleanup(self):
        """Cleanup display"""
        self.clear('black')
        self.update()
        print("📺 Display cleanup complete")