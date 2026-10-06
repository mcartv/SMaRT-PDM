// SMaRT-PDM: Guidance Layout — Guidance Layout (admin frontend component); renders reusable UI and handles local interactions.
import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function GuidanceLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="guidance"
      officeName="Guidance and Counselling Office"
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
