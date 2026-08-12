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
        'RO requests limited to your assigned area',
        'Approve assignments or return them to Admin',
      ]}
      colors={{
        base: '#155e75',
        text: '#ecfeff',
        sub: '#a5f3fc',
        active: '#0e7490',
        mainBg: '#f3fafb',
        accent: '#22d3ee',
      }}
    />
  );
}
