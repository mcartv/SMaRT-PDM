class AppRoutes {
  // Splash & Authentication
  static const splash = '/splash';
  static const login = '/login';
  static const register = '/register';
  static const otp = '/otp';
  static const forgotPassword = '/forgot-password';
  static const changeEmail = '/change-email';

  // Top-level dashboard routes
  static const home = '/home';
  static const payouts = '/payouts';
  static const notifications = '/notifications';
  static const profile = '/profile';

  // Dashboard detail routes
  static const newApplicant = '/new_applicant';
  static const application = '/application';
  static const documents = '/documents';
  static const status = '/status';
  static const interviewSchedule = '/interview-schedule';
  static const announcements = '/announcements';
  static const about = '/about';
  static const faqs = '/faqs';
  static const messaging = '/messaging';
  static const roAssignment = '/ro-assignment';
  static const roCompletion = '/ro-completion';
  static const tickets = '/tickets';
  static const success = '/success';
  static const scholarshipOpenings = '/scholarship-openings';

  static const topLevel = <String>{home, payouts, notifications, profile};

  static bool isTopLevel(String route) => topLevel.contains(route);
}
