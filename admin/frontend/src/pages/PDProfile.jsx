import OfficeProfilePage from '@/components/profile/OfficeProfilePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';
import { pdMaintenanceConfig } from '@/pages/PDMaintenance';

export default function PDProfile() {
  const { theme } = usePortalTheme('pd', getPortalDefaultTheme('pd'));
  const palette = buildMaintenancePalette(theme);

  return (
    <OfficeProfilePage
      storageKey="pdProfile"
      heading="Program Director Profile"
      maintenancePath="/pd/settings"
      portalName="Program Director"
      positionFallback="Program Director"
      departmentFallback="Program Director Office"
      roleFallback="PD Staff"
      avatarTone={theme.base}
      accountConfig={pdMaintenanceConfig}
      palette={palette}
      tokenStorageKey="pdToken"
      responsibilities={[
        'Review applicants from courses assigned to this account.',
        'Confirm academic standing and final endorsement decisions.',
        'Complete endorsement records after SDO and Guidance review.',
      ]}
    />
  );
}
