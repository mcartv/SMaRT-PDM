// SMaRT-PDM: offline gate — offline gate (mobile widget); renders reusable mobile UI behavior.
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/networking/connectivity_controller.dart';

class OfflineGate extends StatefulWidget {
  const OfflineGate({super.key, required this.controller, required this.child});

  final ConnectivityController controller;
  final Widget child;

  @override
  // createState: creates create state for the offline gate flow.
  State<OfflineGate> createState() => _OfflineGateState();
}

class _OfflineGateState extends State<OfflineGate> {
  @override
  // initState: handles init state for the offline gate flow.
  void initState() {
    super.initState();
    widget.controller.addListener(_handleNetworkChange);
  }

  @override
  // didUpdateWidget: handles did update widget for the offline gate flow.
  void didUpdateWidget(covariant OfflineGate oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_handleNetworkChange);
      widget.controller.addListener(_handleNetworkChange);
    }
  }

  // _handleNetworkChange: handles handle network change for the offline gate flow.
  void _handleNetworkChange() {
    if (!widget.controller.isOnline) {
      FocusManager.instance.primaryFocus?.unfocus();
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  // dispose: handles dispose for the offline gate flow.
  void dispose() {
    widget.controller.removeListener(_handleNetworkChange);
    super.dispose();
  }

  @override
  // build: builds build for the offline gate flow.
  Widget build(BuildContext context) {
    final bool blocked = !widget.controller.isOnline;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Theme(
        data: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7C4A2E)),
        ),
        child: PopScope(
          canPop: !blocked,
          child: Stack(
            fit: StackFit.expand,
            children: [
              AbsorbPointer(
                absorbing: blocked,
                child: ExcludeSemantics(
                  excluding: blocked,
                  child: widget.child,
                ),
              ),
              if (blocked)
                Positioned.fill(
                  child: _OfflineScreen(controller: widget.controller),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OfflineScreen extends StatelessWidget {
  const _OfflineScreen({required this.controller});

  final ConnectivityController controller;

  @override
  // build: builds build for the offline gate flow.
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: colorScheme.surface,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 82,
                    height: 82,
                    decoration: BoxDecoration(
                      color: colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: controller.isChecking
                        ? const Padding(
                            padding: EdgeInsets.all(26),
                            child: CircularProgressIndicator(strokeWidth: 3),
                          )
                        : Icon(
                            Icons.cloud_off_rounded,
                            size: 42,
                            color: colorScheme.primary,
                          ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    controller.isChecking
                        ? 'Checking Connection'
                        : 'No Internet Connection',
                    textAlign: TextAlign.center,
                    style: textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    controller.isChecking
                        ? 'Please wait while SMaRT-PDM checks its connection '
                              'to the server. This may take up to a minute '
                              'while the service starts.'
                        : 'SMaRT-PDM requires an active internet connection. '
                              'Typing, navigation, uploads, and other actions are '
                              'disabled until the connection is restored.',
                    textAlign: TextAlign.center,
                    style: textTheme.bodyMedium?.copyWith(
                      height: 1.5,
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: controller.isChecking
                          ? null
                          : () {
                              controller.checkNow(showCheckingState: true);
                            },
                      icon: const Icon(Icons.refresh_rounded),
                      label: Text(
                        controller.isChecking
                            ? 'Checking...'
                            : 'Check Connection',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
