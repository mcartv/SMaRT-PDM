import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/networking/connectivity_controller.dart';

class OfflineGate extends StatefulWidget {
  const OfflineGate({
    super.key,
    required this.controller,
    required this.child,
  });

  final ConnectivityController controller;
  final Widget child;

  @override
  State<OfflineGate> createState() => _OfflineGateState();
}

class _OfflineGateState extends State<OfflineGate> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_handleNetworkChange);
  }

  @override
  void didUpdateWidget(covariant OfflineGate oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_handleNetworkChange);
      widget.controller.addListener(_handleNetworkChange);
    }
  }

  void _handleNetworkChange() {
    if (!widget.controller.isOnline) {
      FocusManager.instance.primaryFocus?.unfocus();
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_handleNetworkChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final blocked = !widget.controller.isOnline;

    return PopScope(
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
              child: ColoredBox(
                color: Theme.of(context).colorScheme.surface,
                child: SafeArea(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 32,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 82,
                              height: 82,
                              decoration: BoxDecoration(
                                color: Theme.of(
                                  context,
                                ).colorScheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: widget.controller.isChecking
                                  ? const Padding(
                                      padding: EdgeInsets.all(26),
                                      child: CircularProgressIndicator(
                                        strokeWidth: 3,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.cloud_off_rounded,
                                      size: 42,
                                    ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              widget.controller.isChecking
                                  ? 'Checking connection'
                                  : 'No Internet Connection',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'SMaRT-PDM requires an active connection to the '
                              'server. Typing, navigation, uploads, and other '
                              'actions are disabled until the connection is '
                              'restored.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(height: 1.5),
                            ),
                            const SizedBox(height: 24),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: widget.controller.isChecking
                                    ? null
                                    : () => widget.controller.checkNow(
                                        showCheckingState: true,
                                      ),
                                icon: const Icon(Icons.refresh_rounded),
                                label: const Text('Check connection'),
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
        ],
      ),
    );
  }
}
