import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function GuidanceLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="guidance"
      title="SMaRT PDM Guidance Panel"
      subtitle="Guidance clearance and moral standing review"
      officeName="Guidance Office"
      loginPath="/guidance/login"
      dashboardPath="/guidance/dashboard"
      trackerPath="/guidance/tracker"
      tokenStorageKey="guidanceToken"
      profileStorageKey="guidanceProfile"
      colors={{
        base: '#1f4e79',
        text: '#e0f2fe',
        sub: '#93c5fd',
        active: '#2f6fa3',
        mainBg: '#f4f8fb',
      }}
    />
  );
}
