// SMaRT-PDM: PDLayout — PDLayout (admin frontend component); renders reusable UI and handles local interactions.
import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function PDLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="pd"
      officeName="Program Director"
      loginPath="/pd/login"
      dashboardPath="/pd/dashboard"
      profilePath="/pd/profile"
      queuePath="/pd/queue"
      trackerPath="/pd/tracker"
      reportsPath="/pd/reports"
      maintenancePath="/pd/settings"
      roQueuePath="/pd/ro-requests"
      tokenStorageKey="pdToken"
      profileStorageKey="pdProfile"
    />
  );
}
