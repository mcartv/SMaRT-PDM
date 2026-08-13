import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function GuidanceLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="guidance"
      officeName="Guidance"
      loginPath="/guidance/login"
      dashboardPath="/guidance/dashboard"
      profilePath="/guidance/profile"
      queuePath="/guidance/queue"
      trackerPath="/guidance/tracker"
      reportsPath="/guidance/reports"
      maintenancePath="/guidance/settings"
      roQueuePath="/guidance/ro-requests"
      tokenStorageKey="guidanceToken"
      profileStorageKey="guidanceProfile"
    />
  );
}
