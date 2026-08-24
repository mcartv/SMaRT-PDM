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
  final source = File(
    'lib/features/dashboard/presentation/screens/dashboard_screen.dart',
  ).readAsStringSync();

  test('Latest Announcements dashboard cards are static previews', () {
    final card = extractClass(source, '_AnnouncementCard');

    expect(card, isNot(contains('InkWell(')));
    expect(card, isNot(contains('chevron_right_rounded')));
    expect(card, contains('button: false'));
    expect(card, contains("label: 'Announcement preview'"));
  });

  test('Available Scholarships dashboard cards are static previews', () {
    final card = extractClass(source, '_OpeningCard');

    expect(card, isNot(contains('InkWell(')));
    expect(card, isNot(contains('chevron_right_rounded')));
    expect(card, contains('button: false'));
    expect(card, contains("label: 'Scholarship opening preview'"));
  });

  test('View all remains the explicit navigation action', () {
    expect(source, contains("title: 'Latest Announcements'"));
    expect(source, contains("title: 'Available Scholarships'"));
    expect(source, contains("actionLabel: 'View all'"));
    expect(source, contains('AppRoutes.announcements'));
    expect(source, contains('AppRoutes.scholarshipOpenings'));
  });
}
