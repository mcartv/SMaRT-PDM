import DepartmentMaintenancePage from '@/components/department/DepartmentMaintenancePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';

const config = {
  shortName: 'SDO',
  themePortalKey: 'sdo',
  pageSubtitle: 'SDO configuration and disciplinary monitoring maintenance',
  featureTitle: 'Disciplinary Monitoring',
  featureLabels: ['Monitoring Active', 'Monitoring Paused'],
  featureFieldLabel: 'Review Cycle',
  featureFieldDefault: 'Weekly',
  auditScope: 'SDO',
  enableStudentRegistryImport: true,
  footerLabel: 'SMaRT PDM · SDO Maintenance Layer',
  account: {
    first_name: 'SDO',
    last_name: 'Officer',
    email: 'sdo@pdm.edu.ph',
    phone_number: '+63 917 000 0000',
    position: 'Student Disciplinary Officer',
    department: 'Student Disciplinary Office',
    role: 'SDO Staff',
  },
  auditEntries: [
    {
      action: 'Updated scholar probation status',
      actor: 'SDO Officer',
      time: 'Apr 08, 2026 · 10:15 AM',
      status: 'Success',
    },
    {
      action: 'Saved SDO profile settings',
      actor: 'SDO Officer',
      time: 'Apr 08, 2026 · 09:42 AM',
      status: 'Success',
    },
    {
      action: 'Viewed disciplinary records dashboard',
      actor: 'SDO Officer',
      time: 'Apr 07, 2026 · 03:10 PM',
      status: 'Viewed',
    },
  ],
};

export default function SDOMaintenance() {
  const { theme } = usePortalTheme('sdo', getPortalDefaultTheme('sdo'));
  const palette = buildMaintenancePalette(theme);

  return (
    <DepartmentMaintenancePage
      config={config}
      palette={palette}
      tokenStorageKey="sdoToken"
      profileStorageKey="sdoProfile"
    />
  );
}
