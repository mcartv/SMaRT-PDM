import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function GuidanceLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="guidance"
      officeName="Guidance Office"
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
      colors={{
        base: '#1f4e79',
        text: '#e0f2fe',
        sub: '#93c5fd',
        active: '#2f6fa3',
        mainBg: '#f4f8fb',
      }}
    />
  );
}
