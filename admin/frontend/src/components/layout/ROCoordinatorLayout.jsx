import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function ROCoordinatorLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="ro_coordinator"
      officeName="RO Coordinator"
      loginPath="/ro-coordinator/login"
      dashboardPath="/ro-coordinator/dashboard"
      profilePath="/ro-coordinator/profile"
      queuePath="/ro-coordinator/queue"
      queueLabel="RO Management"
      reportsPath="/ro-coordinator/reports"
      maintenancePath="/ro-coordinator/settings"
      tokenStorageKey="roCoordinatorToken"
      profileStorageKey="roCoordinatorProfile"
    />
  );
}
