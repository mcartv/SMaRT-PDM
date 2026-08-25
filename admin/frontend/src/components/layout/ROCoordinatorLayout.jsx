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
      queueLabel="RO Request"
      reportsPath="/ro-coordinator/reports"
      maintenancePath="/ro-coordinator/settings"
      tokenStorageKey="roCoordinatorToken"
      profileStorageKey="roCoordinatorProfile"
      colors={{
        base: '#155e75',
        text: '#ecfeff',
        sub: '#a5f3fc',
        active: '#0e7490',
        mainBg: '#f3fafb',
      }}
    />
  );
}
