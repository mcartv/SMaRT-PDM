import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_view.dart';

import '../../../support/applicant_home_test_harness.dart';

void main() {
  testWidgets(
    'uses the real platform scaler despite a conflicting parent MediaQuery',
    (tester) async {
      addTearDown(() => resetApplicantHomeTestView(tester));

      await pumpApplicantHome(
        tester,
        state: populatedApplicantHomeState(longContent: true),
        width: 320,
        platformTextScale: 2,
        parentTextScaler: const TextScaler.linear(.55),
      );

      final homeContext = tester.element(find.byType(ApplicantHomeView));
      final scopedScaler = MediaQuery.textScalerOf(homeContext);

      expect(scopedScaler.scale(10), 20);
      expect(scopedScaler.scale(10), isNot(5.5));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'renders bounded genuine content and routes every visible action',
    (tester) async {
      addTearDown(() => resetApplicantHomeTestView(tester));
      final actions = <ApplicantHomeActionPresentation>[];
      var viewAllOpenings = 0;
      var viewAllUpdates = 0;

      await pumpApplicantHome(
        tester,
        state: populatedApplicantHomeState(),
        onAction: actions.add,
        onViewAllOpenings: () => viewAllOpenings += 1,
        onViewAllUpdates: () => viewAllUpdates += 1,
      );

      expect(find.text('Welcome, Teresa Tolentino'), findsOneWidget);
      expect(find.text('Genmart Scholarship Program 1'), findsOneWidget);
      expect(find.text('Genmart Scholarship Program 3'), findsOneWidget);
      expect(find.text('Genmart Scholarship Program 4'), findsNothing);

      await tester.tap(find.text('Open documents'));
      await tester.pump();
      expect(actions.single.target, ApplicantHomeActionTarget.documents);

      final openingViewAll = find.text('View all').first;
      await tester.ensureVisible(openingViewAll);
      await tester.pump();
      await tester.tap(openingViewAll);
      expect(viewAllOpenings, 1);

      final openingAction = find.text('Review opening').first;
      await tester.ensureVisible(openingAction);
      await tester.pump();
      await tester.tap(openingAction);
      expect(actions.last.target, ApplicantHomeActionTarget.scholarships);
      expect(actions.last.openingId, applicantHomePrivateUuid);

      final updateAction = find.text('Read latest update');
      await tester.ensureVisible(updateAction);
      await tester.pump();
      await tester.tap(updateAction);
      expect(actions.last.target, ApplicantHomeActionTarget.notifications);

      final updateViewAll = find.text('View all').last;
      await tester.ensureVisible(updateViewAll);
      await tester.pump();
      await tester.tap(updateViewAll);
      expect(viewAllUpdates, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('does not expose opaque identifiers or backend vocabulary', (
    tester,
  ) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    final semanticsHandle = tester.ensureSemantics();

    await pumpApplicantHome(
      tester,
      state: populatedApplicantHomeState(longContent: true),
    );

    final renderedText = tester
        .widgetList<Text>(find.byType(Text))
        .map((widget) => widget.data ?? widget.textSpan?.toPlainText() ?? '')
        .join(' ');
    final semanticsText =
        tester.binding.rootPipelineOwner.semanticsOwner?.rootSemanticsNode
            ?.toStringDeep() ??
        '';
    final allUserFacingCopy = '$renderedText $semanticsText';

    for (final privateValue in const [
      applicantHomePrivateUuid,
      applicantHomePrivateIsoDate,
      applicantHomePrivateWorkflowCode,
      applicantHomePrivateReferenceType,
    ]) {
      expect(
        allUserFacingCopy,
        isNot(contains(privateValue)),
        reason: 'Applicant Home exposed private value: $privateValue',
      );
    }

    semanticsHandle.dispose();
  });

  testWidgets('pull to refresh invokes the supplied refresh callback', (
    tester,
  ) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    var refreshes = 0;

    await pumpApplicantHome(
      tester,
      state: populatedApplicantHomeState(),
      onRefresh: () async {
        refreshes += 1;
      },
    );

    await tester.drag(
      find.byKey(const ValueKey<String>('applicant-home-scroll-view')),
      const Offset(0, 420),
    );
    await tester.pumpAndSettle();

    expect(refreshes, 1);
  });

  testWidgets('partial failures preserve cached content and expose retries', (
    tester,
  ) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    var openingRetries = 0;
    var updateRetries = 0;

    await pumpApplicantHome(
      tester,
      state: partialErrorApplicantHomeState(),
      onRetryOpenings: () => openingRetries += 1,
      onRetryLatestUpdate: () => updateRetries += 1,
    );

    expect(find.text('Genmart Scholarship Opening 1'), findsOneWidget);
    expect(
      find.text(
        'Showing saved information. We could not refresh scholarship openings.',
      ),
      findsOneWidget,
    );

    final openingRetry = find.text('Retry');
    await tester.ensureVisible(openingRetry);
    await tester.pump();
    await tester.tap(openingRetry);
    expect(openingRetries, 1);

    final updateFailure = find.text('Updates are unavailable');
    await tester.ensureVisible(updateFailure);
    await tester.pump();
    expect(updateFailure, findsOneWidget);

    final updateRetry = find.text('Try again');
    await tester.ensureVisible(updateRetry);
    await tester.pump();
    await tester.tap(updateRetry);
    expect(updateRetries, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('background refresh keeps cached layout visually stable', (
    tester,
  ) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    final cached = populatedApplicantHomeState();
    final refreshing = cached.copyWith(
      identity: cached.identity.copyWith(isLoading: true),
      applicationStatus: cached.applicationStatus.copyWith(isLoading: true),
      documents: cached.documents.copyWith(isLoading: true),
      openings: cached.openings.copyWith(isLoading: true),
      latestUpdate: cached.latestUpdate.copyWith(isLoading: true),
      isRefreshing: true,
    );

    await pumpApplicantHome(tester, state: refreshing);

    expect(find.text('Welcome, Teresa Tolentino'), findsOneWidget);
    expect(find.text('Upload your remaining documents'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'no-application and activated states use truthful lifecycle copy',
    (tester) async {
      addTearDown(() => resetApplicantHomeTestView(tester));

      await pumpApplicantHome(tester, state: noApplicationApplicantHomeState());
      expect(find.text('Start your scholarship application'), findsOneWidget);
      expect(find.text('Progress will appear here'), findsOneWidget);

      await pumpApplicantHome(tester, state: activatedApplicantHomeState());
      expect(find.text('Your scholarship is active'), findsOneWidget);
      expect(find.text('Active scholar'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
