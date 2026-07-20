import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:smartpdm_mobileapp/core/config/app_config.dart';

enum NetworkAvailability { checking, online, offline }

class ConnectivityController extends ChangeNotifier
    with WidgetsBindingObserver {
  ConnectivityController({
    Connectivity? connectivity,
    http.Client? httpClient,
  }) : _connectivity = connectivity ?? Connectivity(),
       _httpClient = httpClient ?? http.Client();

  final Connectivity _connectivity;
  final http.Client _httpClient;

  StreamSubscription<List<ConnectivityResult>>? _subscription;
  Timer? _periodicCheck;
  bool _started = false;
  bool _checking = false;
  NetworkAvailability _availability = NetworkAvailability.checking;

  NetworkAvailability get availability => _availability;
  bool get isOnline => _availability == NetworkAvailability.online;
  bool get isOffline => _availability == NetworkAvailability.offline;
  bool get isChecking => _availability == NetworkAvailability.checking;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    WidgetsBinding.instance.addObserver(this);

    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      _handleConnectivityChange(results);
    });

    _periodicCheck = Timer.periodic(
      const Duration(seconds: 15),
      (_) => checkNow(),
    );

    await checkNow(showCheckingState: true);
  }

  Future<bool> checkNow({bool showCheckingState = false}) async {
    if (_checking) return isOnline;
    _checking = true;

    if (showCheckingState && _availability != NetworkAvailability.checking) {
      _setAvailability(NetworkAvailability.checking);
    }

    try {
      final connectivityResults = await _connectivity.checkConnectivity();
      final hasNetworkTransport = connectivityResults.any(
        (result) => result != ConnectivityResult.none,
      );

      if (!hasNetworkTransport) {
        _setAvailability(NetworkAvailability.offline);
        return false;
      }

      final normalizedBaseUrl = AppConfig.apiBaseUrl.replaceFirst(
        RegExp(r'/+$'),
        '',
      );

      final healthUri = Uri.parse(
        '$normalizedBaseUrl/api/health?mobileNetworkCheck='
        '${DateTime.now().millisecondsSinceEpoch}',
      );

      final response = await _httpClient
          .get(
            healthUri,
            headers: const {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
            },
          )
          .timeout(const Duration(seconds: 5));

      final connected = response.statusCode >= 200 && response.statusCode < 300;
      _setAvailability(
        connected ? NetworkAvailability.online : NetworkAvailability.offline,
      );

      return connected;
    } on TimeoutException {
      _setAvailability(NetworkAvailability.offline);
      return false;
    } catch (error) {
      debugPrint('CONNECTIVITY CHECK ERROR: $error');
      _setAvailability(NetworkAvailability.offline);
      return false;
    } finally {
      _checking = false;
    }
  }

  Future<void> _handleConnectivityChange(
    List<ConnectivityResult> results,
  ) async {
    final hasNetworkTransport = results.any(
      (result) => result != ConnectivityResult.none,
    );

    if (!hasNetworkTransport) {
      _setAvailability(NetworkAvailability.offline);
      return;
    }

    await checkNow(showCheckingState: true);
  }

  void _setAvailability(NetworkAvailability next) {
    if (_availability == next) return;

    _availability = next;

    if (next != NetworkAvailability.online) {
      FocusManager.instance.primaryFocus?.unfocus();
    }

    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      checkNow(showCheckingState: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _subscription?.cancel();
    _periodicCheck?.cancel();
    _httpClient.close();
    super.dispose();
  }
}
