# Bottom Navigation & Drawer Setup Guide

## 🎯 What Changed

You now have **3 ways** to access all screens:

1. **Bottom Navigation Bar** - Quick access to 5 most-used screens
2. **Side Drawer** - Complete menu for all Applicant and Scholar features
3. **Dashboard Quick Actions** - Direct links from dashboard

---

## 📱 Bottom Navigation Bar

### Current Configuration (5 Items)
```
[0] Home          → /home
[1] Announcements → /announcements
[2] Notifications → /notifications (with badge)
[3] Interviews   → /interview-schedule
[4] Documents    → /documents
```

### Features
- ✅ Notifications badge (shows unread count)
- ✅ All frequently-used screens at bottom
- ✅ Single tap navigation

---

## 🏠 Side Drawer Navigation

### Access
Tap the **menu icon** (≡) at top-left of any screen

### Structure
```
┌─────────────────────────────────┐
│ User Profile Header             │
├─────────────────────────────────┤
│ APPLICANT                       │
│  • Apply for Scholarship        │
│  • Application Status           │
│  • About PDM/OSFA               │
│  • FAQs                         │
├─────────────────────────────────┤
│ SCHOLAR (if approved)           │
│  • Payout Schedule              │
│  • RO Assignment                │
│  • Submit RO Completion         │
│  • Support Ticket               │
├─────────────────────────────────┤
│ ACCOUNT                         │
│  • Profile                      │
│  • Messages                     │
│  • Change Password              │
├─────────────────────────────────┤
│ [LOGOUT BUTTON]                 │
└─────────────────────────────────┘
```

---

## 🔄 How to Update Screens

### For Screens Using SmartPdmPageScaffold

All your screens already use the new scaffold! Just make sure to:

1. **Set the correct selectedIndex** (where tabs highlight)
2. **Pass unreadNotifications** (for badge on notifications)

### Example Usage in a Screen:

```dart
class MyScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Screen'),
        backgroundColor: primaryColor,
      ),
      body: SmartPdmPageScaffold(
        selectedIndex: 1,  // ← Which bottom nav item is active
        unreadNotifications: 5,  // ← Show badge on notifications
        child: Column(
          children: [
            Text('Screen content here'),
          ],
        ),
      ),
    );
  }
}
```

---

## 📊 Bottom Navigation Index Reference

| Index | Screen | Route | Use When |
|-------|--------|-------|----------|
| 0 | Dashboard | /home | Showing main dashboard |
| 1 | Announcements | /announcements | In announcements screen |
| 2 | Notifications | /notifications | In notifications screen |
| 3 | Interviews | /interview-schedule | In interview schedule |
| 4 | Documents | /documents | In renewal requirements |

---

## 🎨 Customization Options

### Change Bottom Navigation Items

Edit `smart_pdm_bottom_nav.dart`:

```dart
static const List<String> _routes = ['/home', '/page1', '/page2'];
static const List<IconData> _icons = [Icons.home, Icons.icon1, Icons.icon2];
static const List<String> _labels = ['Home', 'Label1', 'Label2'];
```

### Hide Bottom Navigation on Specific Screens

If you DON'T want the bottom nav on a screen:

```dart
Scaffold(
  body: Column(...),  // No SmartPdmPageScaffold wrapper
)
```

### Hide Drawer on Specific Screens

```dart
SmartPdmPageScaffold(
  showDrawer: false,  // Disable drawer
  child: Container(...),
)
```

### Customize Drawer Items

Edit `smart_pdm_drawer.dart` to add/remove drawer menu items.

---

## 🔔 Notification Badge

The notification badge automatically appears when there are unread notifications.

### Enable Badge

```dart
SmartPdmPageScaffold(
  selectedIndex: 0,
  unreadNotifications: 5,  // ← Shows "5" on notifications icon
  child: child,
)
```

### How It Works

```dart
if (hasNotification)  // True if index == 2 and count > 0
  Container(
    child: Text('5'),  // Shows count (max "9+")
  )
```

---

## 📝 Screen Implementation Checklist

For each screen using the new navigation:

- [ ] Wrap content with `SmartPdmPageScaffold`
- [ ] Set correct `selectedIndex` (0-4)
- [ ] Pass `unreadNotifications` count if applicable
- [ ] Import `SmartPdmPageScaffold` from `widgets`
- [ ] Set `showDrawer: true` (default) to show menu icon

---

## 🚀 Quick Access Routes

All routes are configured in `main.dart`:

```dart
routes: {
  '/home': (context) => const DashboardScreen(),
  '/announcements': (context) => const AnnouncementsScreen(),
  '/notifications': (context) => const NotificationsScreen(),
  '/interview-schedule': (context) => const InterviewScheduleScreen(),
  '/documents': (context) => const RenewalRequirementsScreen(),
  '/payouts': (context) => const PayoutScheduleScreen(),
  '/ro-assignment': (context) => const ROAssignmentScreen(),
  '/ro-completion': (context) => ROCompletionScreen(),
  '/tickets': (context) => const ReportTicketScreen(),
  // ... and more
}
```

---

## 💡 Pro Tips

1. **Deep Linking**: All routes support direct navigation
   ```dart
   Navigator.pushNamed(context, '/notifications');
   ```

2. **Pass Arguments**: 
   ```dart
   Navigator.pushNamed(
     context, 
     '/ro-completion',
     arguments: assignmentData,
   );
   ```

3. **Role-Based Display**: Drawer automatically shows Scholar section only for verified users

4. **Customizable Badges**: Modify `SmartPdmBottomNav` to add badges to other items

---

## 🎯 Navigation Flow Example

```
User Opens App
    ↓
Dashboard Screen (selectedIndex: 0)
    ├─ Tap Bottom Nav [1] → Announcements (selectedIndex: 1)
    ├─ Tap Menu Icon → Drawer Opens
    │   └─ Tap "RO Assignment" → Goes to /ro-assignment (selectedIndex: -1 for drawer items)
    └─ Tap Notifications Icon → Notifications (selectedIndex: 2)
         └ Shows Badge if unread > 0
```

---

## ⚠️ Important Notes

1. **selectedIndex** only affects the bottom bar highlight
2. Drawer navigation also works even though items aren't in bottom bar
3. Each screen should independently manage its own `selectedIndex`
4. Use `SmartPdmPageScaffold` as your main scaffold wrapper

---

## 📞 Support

Need to adjust navigation? You can:
- Modify `smart_pdm_bottom_nav.dart` for bottom bar
- Modify `smart_pdm_drawer.dart` for drawer menu
- Modify `smart_pdm_page_scaffold.dart` for overall behavior
- Add new routes in `main.dart`
