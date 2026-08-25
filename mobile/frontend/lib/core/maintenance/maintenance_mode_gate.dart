import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class MaintenanceModeGate extends StatefulWidget {
  const MaintenanceModeGate({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  State<MaintenanceModeGate> createState() => _MaintenanceModeGateState();
}

class _MaintenanceModeGateState extends State<MaintenanceModeGate>
    with WidgetsBindingObserver {
  final ApiClient _apiClient = ApiClient();
  Timer? _pollTimer;
  bool _maintenanceMode = false;
  bool _checking = false;
  String _message =
      'SMaRT-PDM is temporarily unavailable while system maintenance is in progress. Please try again later.';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _refresh(silent: true),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refresh(silent: true);
    }
  }

  Future<void> _refresh({bool silent = false}) async {
    if (_checking) return;

    if (!silent && mounted) {
      setState(() => _checking = true);
    } else {
      _checking = true;
    }

    try {
      final payload = await _apiClient.getObject(
        '/api/system-maintenance/public',
        timeout: const Duration(seconds: 8),
      );

      if (!mounted) return;

      final enabled = payload['maintenance_mode'] == true;
      final rawMessage = payload['maintenance_message']?.toString().trim() ?? '';

      setState(() {
        _maintenanceMode = enabled;
        if (rawMessage.isNotEmpty) {
          _message = rawMessage;
        }
      });
    } catch (_) {
      // Fail open only when maintenance status has never been confirmed as on.
      // If maintenance is already active, keep the gate visible until the
      // backend explicitly reports that maintenance mode has been disabled.
    } finally {
      if (mounted) {
        setState(() => _checking = false);
      } else {
        _checking = false;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_maintenanceMode)
          Positioned.fill(
            child: Material(
              color: Colors.black54,
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Card(
                        elevation: 10,
                        margin: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .primaryContainer,
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: Icon(
                                  Icons.build_circle_outlined,
                                  size: 30,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onPrimaryContainer,
                                ),
                              ),
                              const SizedBox(height: 18),
                              Text(
                                'System Maintenance',
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                _message,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(height: 1.45),
                              ),
                              const SizedBox(height: 18),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton.icon(
                                  onPressed: _checking ? null : () => _refresh(),
                                  icon: _checking
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(Icons.refresh_rounded),
                                  label: Text(
                                    _checking ? 'Checking...' : 'Check Again',
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
