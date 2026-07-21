class MobileRealtimeEvents {
  const MobileRealtimeEvents._();

  // Notifications
  static const notificationNew = 'notification:new';
  static const notificationCreated = 'notification:created';
  static const notificationUpdated = 'notification:updated';
  static const notificationDeleted = 'notification:deleted';
  static const notificationArchived = 'notification:archived';
  static const notificationRestored = 'notification:restored';
  static const notificationRead = 'notification:read';
  static const notificationReadAll = 'notification:read-all';

  // Notification compatibility aliases
  static const notificationsUpdated = 'notifications:updated';
  static const notificationCreatedLegacy = 'notificationCreated';
  static const notificationUpdatedLegacy = 'notificationUpdated';

  // Announcements
  static const announcementCreated = 'announcement:created';
  static const announcementUpdated = 'announcement:updated';
  static const announcementPublished = 'announcement:published';
  static const announcementArchived = 'announcement:archived';
  static const announcementRestored = 'announcement:restored';
  static const announcementDeleted = 'announcement:deleted';
  static const announcementRefresh = 'announcement:refresh';

  // Scholarships
  static const openingCreated = 'opening:created';
  static const openingUpdated = 'opening:updated';
  static const openingClosed = 'opening:closed';
  static const openingArchived = 'opening:archived';
  static const openingRestored = 'opening:restored';

  // Aliases only. These use the same actual backend event names.
  static const programOpeningCreated = openingCreated;
  static const programOpeningUpdated = openingUpdated;
  static const programOpeningArchived = openingArchived;
  static const programOpeningRestored = openingRestored;

  // Applications
  static const applicationCreated = 'application:created';
  static const applicationUpdated = 'application:updated';
  static const applicationApproved = 'application:approved';
  static const applicationRejected = 'application:rejected';
  static const applicationDisqualified = 'application:disqualified';

  // Application Documents
  static const applicationDocumentUploaded = 'application-document:uploaded';
  static const applicationDocumentReviewed = 'application-document:reviewed';

  // OCR
  static const applicationOcrQueued = 'application-ocr:queued';
  static const applicationOcrSnapshotSaved = 'application-ocr:snapshot-saved';

  // Endorsement
  static const endorsementUpdated = 'endorsement:updated';

  // Scholars
  static const scholarCreated = 'scholar:created';
  static const scholarUpdated = 'scholar:updated';
  static const scholarArchived = 'scholar:archived';
  static const scholarRestored = 'scholar:restored';

  // Renewal
  static const renewalCreated = 'renewal:created';
  static const renewalUpdated = 'renewal:updated';
  static const renewalApproved = 'renewal:approved';
  static const renewalRejected = 'renewal:rejected';

  // Return of Obligation
  static const roCreated = 'ro:created';
  static const roAssigned = 'ro:assigned';
  static const roAcknowledged = 'ro:acknowledged';
  static const roConflictReported = 'ro:conflict-reported';
  static const roUpdated = 'ro:updated';
  static const roUpdatedLegacy = 'roUpdated';
  static const roCleared = 'ro:cleared';
  static const roProgressUpdated = 'ro:progress-updated';
  static const roTimeIn = 'ro:time-in';
  static const roTimeOut = 'ro:time-out';
  static const roLogCreated = 'ro:log-created';
  static const roLogUpdated = 'ro:log-updated';
  static const roSettingsUpdated = 'ro:settings-updated';

  // Payouts
  static const payoutCreated = 'payout:created';
  static const payoutUpdated = 'payout:updated';
  static const payoutDeleted = 'payout:deleted';
  static const payoutArchived = 'payout:archived';
  static const payoutRestored = 'payout:restored';
  static const scholarReleased = 'scholar:released';

  // Tickets
  static const ticketCreated = 'ticket:created';
  static const ticketUpdated = 'ticket:updated';
  static const ticketResolved = 'ticket:resolved';
  static const ticketArchived = 'ticket:archived';
  static const ticketRestored = 'ticket:restored';

  // Messages
  static const messageNew = 'message:new';
  static const messageCreated = 'message:created';
  static const messageUpdated = 'message:updated';
  static const messageRead = 'message:read';
  static const messageUnread = 'message:unread';
  static const messageThreadArchived = 'message:thread-archived';
  static const messageThreadRestored = 'message:thread-restored';
  static const roomCreated = 'room:created';
  static const roomMembersAdded = 'room:members-added';

  static final Set<String> notificationEvents = <String>{
    notificationNew,
    notificationCreated,
    notificationUpdated,
    notificationDeleted,
    notificationArchived,
    notificationRestored,
    notificationRead,
    notificationReadAll,

    // Compatibility aliases
    notificationsUpdated,
    notificationCreatedLegacy,
    notificationUpdatedLegacy,
  };

  static final Set<String> officeUpdateEvents = <String>{
    ...notificationEvents,
    announcementCreated,
    announcementUpdated,
    announcementPublished,
    announcementArchived,
    announcementRestored,
    announcementDeleted,
    announcementRefresh,
    openingCreated,
    openingUpdated,
    openingClosed,
    openingArchived,
    openingRestored,
  };

  static final Set<String> applicationEvents = <String>{
    applicationCreated,
    applicationUpdated,
    applicationApproved,
    applicationRejected,
    applicationDisqualified,
    applicationDocumentUploaded,
    applicationDocumentReviewed,
    applicationOcrQueued,
    applicationOcrSnapshotSaved,
    endorsementUpdated,
  };

  static final Set<String> scholarEvents = <String>{
    scholarCreated,
    scholarUpdated,
    scholarArchived,
    scholarRestored,
    renewalCreated,
    renewalUpdated,
    renewalApproved,
    renewalRejected,
  };

  static final Set<String> roEvents = <String>{
    roCreated,
    roAssigned,
    roAcknowledged,
    roConflictReported,
    roUpdated,
    roUpdatedLegacy,
    roCleared,
    roProgressUpdated,
    roTimeIn,
    roTimeOut,
    roLogCreated,
    roLogUpdated,
    roSettingsUpdated,
  };

  static final Set<String> payoutEvents = <String>{
    payoutCreated,
    payoutUpdated,
    payoutDeleted,
    payoutArchived,
    payoutRestored,
    scholarReleased,
  };

  static final Set<String> ticketEvents = <String>{
    ticketCreated,
    ticketUpdated,
    ticketResolved,
    ticketArchived,
    ticketRestored,
  };

  static final Set<String> messageEvents = <String>{
    messageNew,
    messageCreated,
    messageUpdated,
    messageRead,
    messageUnread,
    messageThreadArchived,
    messageThreadRestored,
    roomCreated,
    roomMembersAdded,
  };

  static final Set<String> dashboardEvents = <String>{
    ...officeUpdateEvents,
    ...applicationEvents,
    ...scholarEvents,
    ...roEvents,
    ...payoutEvents,
  };

  static final Set<String> notificationProviderEvents = <String>{
    ...officeUpdateEvents,
    ...applicationEvents,
    ...scholarEvents,
    ...roEvents,
    ...payoutEvents,
    ...ticketEvents,
  };

  static final Set<String> all = <String>{
    ...dashboardEvents,
    ...ticketEvents,
    ...messageEvents,
  };
}
