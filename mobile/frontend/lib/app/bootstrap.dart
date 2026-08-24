import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/app.dart';
import 'package:smartpdm_mobileapp/core/config/app_config.dart';
import 'package:smartpdm_mobileapp/app/theme/theme_provider.dart';
import 'package:smartpdm_mobileapp/core/networking/connectivity_controller.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/providers/new_scholar_provider.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/offline_gate.dart';

void bootstrapApp() {
  WidgetsFlutterBinding.ensureInitialized();

  debugPrint('Startup API base URL: ${AppConfig.apiBaseUrl}');

  final connectivityController = ConnectivityController();
  unawaited(connectivityController.start());

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => NewScholarProvider()),
        ChangeNotifierProvider(create: (_) => MessagingProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: OfflineGate(
        controller: connectivityController,
        child: const SmartPdmApp(),
      ),
    ),
  );
}
