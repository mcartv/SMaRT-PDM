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
      colors={{ base: '#1f4e79', sub: '#93c5fd', accent: '#38bdf8' }}
    />
  );
}
