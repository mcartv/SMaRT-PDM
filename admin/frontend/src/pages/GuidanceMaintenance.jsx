import DepartmentMaintenancePage from '@/components/department/DepartmentMaintenancePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';

const config = {
  shortName: 'Guidance',
  themePortalKey: 'guidance',
  pageSubtitle: 'Guidance Office configuration and counseling review maintenance',
  featureTitle: 'Counseling Review Settings',
  featureLabels: ['Counseling Queue Open', 'Counseling Queue Paused'],
  featureFieldLabel: 'Counseling Schedule',
  featureFieldDefault: 'Daily review window',
  auditScope: 'GCO',
  footerLabel: 'SMaRT PDM · Guidance Maintenance Layer',
  account: {
    first_name: 'Guidance',
    last_name: 'Counselor',
    email: 'guidance@pdm.edu.ph',
    phone_number: '+63 917 200 0000',
    position: 'Guidance Counselor',
    department: 'Guidance Office',
    role: 'Guidance Staff',
  },
  auditEntries: [
    {
      action: 'Saved guidance counseling preferences',
      actor: 'Guidance Counselor',
      time: 'Apr 08, 2026 · 01:12 PM',
      status: 'Success',
    },
    {
      action: 'Reviewed guidance endorsement queue',
      actor: 'Guidance Counselor',
      time: 'Apr 08, 2026 · 11:03 AM',
      status: 'Viewed',
    },
    {
      action: 'Updated guidance office contact details',
      actor: 'Guidance Counselor',
      time: 'Apr 07, 2026 · 03:56 PM',
      status: 'Success',
    },
  ],
};

export default function GuidanceMaintenance() {
  const { theme } = usePortalTheme('guidance', getPortalDefaultTheme('guidance'));
  const palette = buildMaintenancePalette(theme);

  return (
    <DepartmentMaintenancePage
      config={config}
      palette={palette}
      tokenStorageKey="guidanceToken"
      profileStorageKey="guidanceProfile"
    />
  );
}
