import tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from camera import CameraController

class CameraFocusGateTest(unittest.TestCase):
    def test_focus_states(self):
        self.assertTrue(CameraController._focus_state({"AfState":"Focused"}))
        self.assertFalse(CameraController._focus_state({"AfState":"Failed"}))
        self.assertIsNone(CameraController._focus_state({}))
    def test_blur_rejected(self):
        c=CameraController(); c.capture_width=c.capture_height=1; c.minimum_jpeg_bytes=1
        with tempfile.TemporaryDirectory() as d:
            i=Path(d)/"x.jpg"; m=Path(d)/"x.json"; i.write_bytes(b"jpeg"); m.write_text('{"AfState":"Focused"}')
            with patch.object(c,"_jpeg_dimensions",return_value=(1,1)), patch.object(c,"_sharpness",return_value=1.0):
                ok,_=c._validate(str(i),str(m))
        self.assertFalse(ok)
if __name__ == "__main__": unittest.main()
