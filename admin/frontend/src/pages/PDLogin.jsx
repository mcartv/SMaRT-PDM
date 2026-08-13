import DepartmentPortalLogin from './DepartmentPortalLogin';

export default function PDLogin() {
  return (
    <DepartmentPortalLogin
      portalKey="pd"
      portalLabel="PD"
      officeName="Program Director"
      authPath="/api/auth/pd/login"
      tokenStorageKey="pdToken"
      profileStorageKey="pdProfile"
      redirectPath="/pd/dashboard"
    />
  );
}
