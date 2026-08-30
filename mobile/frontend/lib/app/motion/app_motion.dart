import 'package:flutter/material.dart';

/// Shared, restrained motion for SMaRT-PDM.
///
/// Navigation routes render without visual transitions. Motion constants below
/// remain available for non-navigation micro-interactions.
class AppMotion {
  AppMotion._();

  static const Duration fast = Duration(milliseconds: 160);
  static const Duration standard = Duration(milliseconds: 240);
  static const Duration relaxed = Duration(milliseconds: 300);

  static const Curve enterCurve = Curves.easeOutCubic;
  static const Curve exitCurve = Curves.easeInCubic;

  static const PageTransitionsTheme pageTransitionsTheme =
      PageTransitionsTheme(
    builders: <TargetPlatform, PageTransitionsBuilder>{
      TargetPlatform.android: _SmartPdmPageTransitionsBuilder(),
      TargetPlatform.iOS: _SmartPdmPageTransitionsBuilder(),
      TargetPlatform.macOS: _SmartPdmPageTransitionsBuilder(),
      TargetPlatform.windows: _SmartPdmPageTransitionsBuilder(),
      TargetPlatform.linux: _SmartPdmPageTransitionsBuilder(),
      TargetPlatform.fuchsia: _SmartPdmPageTransitionsBuilder(),
    },
  );
}

class _SmartPdmPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SmartPdmPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    // Navigation is intentionally instant on mobile. The previous combined
    // fade/slide transition could look like the page was shaking when a
    // destination rebuilt while realtime data was arriving.
    return child;
  }
}

/// One-shot reveal used for Dashboard bento cards.
///
/// It does not replay on every data refresh because the animation controller
/// runs only when this widget enters the tree.
class AppMotionReveal extends StatefulWidget {
  const AppMotionReveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
  });

  final Widget child;
  final Duration delay;

  @override
  State<AppMotionReveal> createState() => _AppMotionRevealState();
}

class _AppMotionRevealState extends State<AppMotionReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: AppMotion.standard,
    );

    final curved = CurvedAnimation(
      parent: _controller,
      curve: AppMotion.enterCurve,
    );

    _opacity = Tween<double>(begin: 0, end: 1).animate(curved);
    _offset = Tween<Offset>(
      begin: const Offset(0, 0.035),
      end: Offset.zero,
    ).animate(curved);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      if (widget.delay != Duration.zero) {
        await Future<void>.delayed(widget.delay);
      }

      if (mounted) {
        _controller.forward();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeOf(context)?.disableAnimations == true) {
      return widget.child;
    }

    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(
        position: _offset,
        child: widget.child,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
