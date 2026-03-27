import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/screens/login_screen.dart';
import 'package:smartpdm_mobileapp/screens/register_screen.dart';
import 'package:smartpdm_mobileapp/screens/otp_screen.dart';
import 'package:smartpdm_mobileapp/constants.dart'; // Import constants for colors
import 'package:smartpdm_mobileapp/screens/dashboard_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SMaRT-PDM',
      theme: ThemeData(
        // Define a custom color scheme using your constants
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor, // Use your primary color as the seed
          primary: primaryColor,
          secondary: accentColor,
          // You can define other colors here as well, e.g., background, surface, etc.
        ),
        // The primarySwatch is a MaterialColor (a map of 10 shades).
        // If you want to use your single primaryColor as the primarySwatch,
        // you need to create a MaterialColor from it.
        // This ensures older widgets or those relying on primarySwatch still get your color.
        primarySwatch: MaterialColor(primaryColor.value, <int, Color>{
          50: primaryColor.withOpacity(0.1), 100: primaryColor.withOpacity(0.2), 200: primaryColor.withOpacity(0.3), 300: primaryColor.withOpacity(0.4), 400: primaryColor.withOpacity(0.5), 500: primaryColor.withOpacity(0.6), 600: primaryColor.withOpacity(0.7), 700: primaryColor.withOpacity(0.8), 800: primaryColor.withOpacity(0.9), 900: primaryColor.withOpacity(1.0),
        }),
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      initialRoute: '/login', // Set your initial route
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/otp': (context) => const OtpScreen(),
        '/home': (context) => const DashboardScreen(), // This is the missing route
        // Add other routes here as needed
      },
      debugShowCheckedModeBanner: false, // Set to true for debugging
    );
  }
}