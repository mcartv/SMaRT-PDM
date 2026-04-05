import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';

class SuccessScreen extends StatelessWidget {
  const SuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};
    final title =
        payload['title']?.toString() ?? 'Application Submitted Successfully!';
    final message =
        payload['message']?.toString() ??
        'Please check your email for a confirmation and a reminder of documentary requirements.';
    final appBarTitle =
        payload['appBarTitle']?.toString() ?? 'Application Submitted';

    return Scaffold(
      appBar: AppBar(
        title: Text(appBarTitle),
        backgroundColor: primaryColor,
        automaticallyImplyLeading: false, // Prevent back button
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(padding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.check_circle_outline,
                color: Colors.green,
                size: 100,
              ),
              const SizedBox(height: 20),
              Text(
                title,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 30),
              ElevatedButton(
                onPressed: () {
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    '/home',
                    (route) => false,
                  ); // Go back to dashboard
                },
                child: const Text('Back to Dashboard'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
