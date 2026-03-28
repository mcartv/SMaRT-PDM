import 'package:flutter/material.dart';

// Base URL for your backend API
// IMPORTANT: Replace '192.168.22.2' with the actual IP address of your machine
// running the Node.js server.
// For Android Emulator, you might use '10.0.2.2'.
// For iOS Simulator, you might use 'http://localhost:3000' or 'http://127.0.0.1:3000'.
// For physical devices, use your machine's actual local IP (e.g., 192.168.1.X).
const String BASE_URL = 'http://192.168.22.2:3000';

// PRIMARY COLORS
const Color pdmYellow = Color(0xFFFFE300);
const Color pdmGold = Color(0xFFF5B80A);
const Color pdmBrown = Color(0xFF5C3000);
const Color pdmDarkBrown = Color(0xFF331A00);
const Color pdmWhite = Color(0xFFFFFFFF);

// SECONDARY COLORS
const Color pdmLightBlue = Color(0xFF6BC9C9);
const Color pdmTeal = Color(0xFF006354);
const Color pdmOrange = Color(0xFFC76917);
const Color pdmMagenta = Color(0xFFA80087);
const Color pdmLightGray = Color(0xFFDAD9D6);
const Color pdmBlack = Color(0xFF000000);

// Common colors (Mapped for backward compatibility)
const Color primaryColor = pdmBrown;
const Color accentColor = pdmGold;
const Color backgroundColor = pdmWhite;
const Color textColor = pdmBlack;
const Color mutedColor = pdmLightGray;

// Common dimensions (example, adjust as needed)
const double borderRadius = 8.0;
const double padding = 16.0;