import DepartmentPortalLogin from './DepartmentPortalLogin';

export default function GuidanceLogin() {
  return (
    <DepartmentPortalLogin
      portalKey="guidance"
      portalLabel="Guidance"
      officeName="Guidance Office"
      authPath="/api/auth/guidance/login"
      tokenStorageKey="guidanceToken"
      profileStorageKey="guidanceProfile"
      redirectPath="/guidance/dashboard"
    />
  );
}
