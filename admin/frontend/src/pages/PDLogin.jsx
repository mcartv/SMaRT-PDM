import DepartmentPortalLogin from './DepartmentPortalLogin';

export default function PDLogin() {
  return (
    <DepartmentPortalLogin
      portalKey="pd"
      portalLabel="PD"
      officeName="Program Director Office"
      authPath="/api/auth/pd/login"
      tokenStorageKey="pdToken"
      profileStorageKey="pdProfile"
      redirectPath="/pd/dashboard"
      colors={{ base: '#5f3d8a', sub: '#d8b4fe', accent: '#c084fc' }}
    />
  );
}
