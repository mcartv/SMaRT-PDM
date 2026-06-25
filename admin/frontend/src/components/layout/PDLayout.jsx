import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function PDLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="pd"
      title="SMaRT PDM PD Panel"
      subtitle="Program director endorsement review"
      officeName="Program Director Office"
      loginPath="/pd/login"
      dashboardPath="/pd/dashboard"
      tokenStorageKey="pdToken"
      profileStorageKey="pdProfile"
      colors={{
        base: '#5f3d8a',
        text: '#f3e8ff',
        sub: '#d8b4fe',
        active: '#7652a3',
        mainBg: '#f8f5fb',
      }}
    />
  );
}
