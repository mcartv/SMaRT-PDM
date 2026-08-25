import DepartmentPortalLogin from './DepartmentPortalLogin';

export default function SDOLogin() {
  return (
    <DepartmentPortalLogin
      portalKey="sdo"
      portalLabel="SDO"
      officeName="Student Disciplinary Office"
      authPath="/api/auth/sdo/login"
      tokenStorageKey="sdoToken"
      profileStorageKey="sdoProfile"
      redirectPath="/sdo/dashboard"
      colors={{ base: '#2e4b43', sub: '#a7f3d0', accent: '#16a34a' }}
    />
  );
}
