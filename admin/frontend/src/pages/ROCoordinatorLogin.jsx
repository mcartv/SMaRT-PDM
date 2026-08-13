import DepartmentPortalLogin from './DepartmentPortalLogin';

export default function ROCoordinatorLogin() {
  return (
    <DepartmentPortalLogin
      portalKey="ro_coordinator"
      portalLabel="RO Coordinator"
      officeName="Return of Obligation"
      authPath="/api/auth/ro-coordinator/login"
      tokenStorageKey="roCoordinatorToken"
      profileStorageKey="roCoordinatorProfile"
      redirectPath="/ro-coordinator/dashboard"
      featureLabels={[
        'Placements limited to your assigned RO area',
        'Review placement approvals and attendance validation',
      ]}
    />
  );
}
