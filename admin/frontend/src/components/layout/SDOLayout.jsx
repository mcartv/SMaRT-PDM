import { ShieldAlert } from 'lucide-react';
import DepartmentPortalLayout from './DepartmentPortalLayout';

export default function SDOLayout() {
  return (
    <DepartmentPortalLayout
      portalKey="sdo"
      officeName="Student Disciplinary Office"
      loginPath="/sdo/login"
      dashboardPath="/sdo/dashboard"
      profilePath="/sdo/profile"
      queuePath="/sdo/queue"
      trackerPath="/sdo/tracker"
      reportsPath="/sdo/reports"
      maintenancePath="/sdo/settings"
      roQueuePath="/sdo/ro-requests"
      tokenStorageKey="sdoToken"
      profileStorageKey="sdoProfile"
      extraNavItems={[
        { path: '/sdo/scholars', label: 'Scholar List', icon: ShieldAlert },
      ]}
    />
  );
}
