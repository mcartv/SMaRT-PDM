import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';

class MessagingBubble extends StatelessWidget {
  const MessagingBubble({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final unreadCount = provider.unreadCount;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Semantics(
      button: true,
      label: unreadCount > 0
          ? 'Open Messages. $unreadCount unread messages.'
          : 'Open Messages',
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.34 : 0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: FloatingActionButton(
              heroTag: 'global-messaging-bubble',
              tooltip: 'Messages',
              onPressed: () => Navigator.of(context).pushNamed(
                AppRoutes.messaging,
              ),
              elevation: 0,
              highlightElevation: 0,
              backgroundColor: isDark ? AppColors.gold : AppColors.darkBrown,
              foregroundColor: isDark ? AppColors.darkBrown : AppColors.gold,
              shape: CircleBorder(
                side: BorderSide(
                  color: AppColors.gold.withValues(alpha: 0.70),
                  width: 1.5,
                ),
              ),
              child: const Icon(Icons.forum_rounded, size: 27),
            ),
          ),
          if (unreadCount > 0)
            Positioned(
              right: -5,
              top: -6,
              child: Container(
                constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE53935),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: isDark ? const Color(0xFF24180F) : Colors.white,
                    width: 2,
                  ),
                ),
                child: Text(
                  unreadCount > 99 ? '99+' : '$unreadCount',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
