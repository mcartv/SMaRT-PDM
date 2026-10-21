import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String extractClass(String source, String className) {
  final start = source.indexOf('class $className');
  expect(start, greaterThanOrEqualTo(0));

  final openBrace = source.indexOf('{', start);
  expect(openBrace, greaterThanOrEqualTo(0));

  var depth = 0;
  for (var i = openBrace; i < source.length; i++) {
    if (source[i] == '{') depth++;
    if (source[i] == '}') {
      depth--;
      if (depth == 0) return source.substring(start, i + 1);
    }
  }

  fail('Unable to isolate $className');
}

void main() {
  final dashboardSource = File(
    'lib/features/dashboard/presentation/screens/dashboard_screen.dart',
  ).readAsStringSync();
  final openingsSource = File(
    'lib/features/dashboard/presentation/widgets/applicant_openings_section.dart',
  ).readAsStringSync();

  test('Latest Announcements cards open the selected announcement', () {
    final card = extractClass(dashboardSource, '_AnnouncementCard');

    expect(card, contains('InkWell('));
    expect(card, contains('onTap: onTap'));
    expect(card, contains('button: true'));
    expect(card, contains("label: 'Open announcement:"));
  });

  test('Available Scholarship cards expose one clear action', () {
    final card = extractClass(openingsSource, '_OpeningCard');

    expect(card, isNot(contains('InkWell(')));
    expect(card, contains('OutlinedButton.icon('));
    expect(card, contains('onAction(opening.action)'));
    expect(card.toLowerCase(), isNot(contains('available slots')));
  });

  test('Dashboard keeps announcements directly below the main card', () {
    final hero = dashboardSource.lastIndexOf('_buildHero()');
    final announcements = dashboardSource.indexOf("'Latest Announcements'", hero);
    final dashboardBody = dashboardSource.substring(hero, announcements);

    expect(hero, greaterThanOrEqualTo(0));
    expect(announcements, greaterThan(hero));
    expect(dashboardBody, contains('_buildBentoDashboard()'));
    expect(dashboardSource, contains('AppRoutes.scholarshipOpenings'));
  });
}
