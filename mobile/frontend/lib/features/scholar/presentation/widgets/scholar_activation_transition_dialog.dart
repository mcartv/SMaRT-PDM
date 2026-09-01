import 'dart:async';

import 'package:flutter/material.dart';

class ScholarActivationTransitionDialog extends StatefulWidget {
  const ScholarActivationTransitionDialog({
    super.key,
    required this.synchronize,
  });

  final Future<bool> Function() synchronize;

  @override
  State<ScholarActivationTransitionDialog> createState() =>
      _ScholarActivationTransitionDialogState();
}

class _ScholarActivationTransitionDialogState
    extends State<ScholarActivationTransitionDialog> {
  bool _isSynchronizing = true;
  bool _isComplete = false;
  int _runGeneration = 0;

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(_runSynchronization);
  }

  Future<void> _runSynchronization() async {
    final generation = ++_runGeneration;
    if (mounted) {
      setState(() {
        _isSynchronizing = true;
        _isComplete = false;
      });
    }

    const retryDelays = <Duration>[
      Duration.zero,
      Duration(seconds: 1),
      Duration(seconds: 3),
    ];

    for (final delay in retryDelays) {
      if (delay > Duration.zero) await Future<void>.delayed(delay);
      if (!mounted || generation != _runGeneration) return;

      var synchronized = false;
      try {
        synchronized = await widget.synchronize();
      } catch (_) {
        synchronized = false;
      }
      if (!mounted || generation != _runGeneration) return;
      if (!synchronized) continue;

      setState(() {
        _isSynchronizing = false;
        _isComplete = true;
      });
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (mounted && generation == _runGeneration) {
        Navigator.of(context).pop(true);
      }
      return;
    }

    if (mounted && generation == _runGeneration) {
      setState(() => _isSynchronizing = false);
    }
  }

  @override
  void dispose() {
    _runGeneration += 1;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return PopScope(
      canPop: !_isSynchronizing,
      child: AlertDialog(
        icon: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: _isComplete
              ? Icon(
                  Icons.check_circle_rounded,
                  key: const ValueKey('complete'),
                  color: colors.primary,
                  size: 42,
                )
              : _isSynchronizing
              ? const SizedBox(
                  key: ValueKey('loading'),
                  width: 38,
                  height: 38,
                  child: CircularProgressIndicator(strokeWidth: 3),
                )
              : Icon(
                  Icons.sync_problem_rounded,
                  key: const ValueKey('recovery'),
                  color: colors.tertiary,
                  size: 42,
                ),
        ),
        title: Text(
          _isComplete
              ? 'Scholar access activated'
              : _isSynchronizing
              ? 'Scholarship approved'
              : 'Account update is taking longer',
          textAlign: TextAlign.center,
        ),
        content: Text(
          _isComplete
              ? 'Welcome! Your Scholar features are now available.'
              : _isSynchronizing
              ? 'Your account is being updated with Scholar access. Please wait.'
              : 'We could not confirm the update yet. Check your connection and try again. If this continues, signing in again can refresh your session.',
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: _isSynchronizing || _isComplete
            ? null
            : [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Continue as Applicant'),
                ),
                FilledButton.icon(
                  onPressed: _runSynchronization,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Try Again'),
                ),
              ],
      ),
    );
  }
}
