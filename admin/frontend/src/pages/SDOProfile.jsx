import OfficeProfilePage from '@/components/profile/OfficeProfilePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';
import { sdoMaintenanceConfig } from '@/pages/SDOMaintenance';

export default function SDOProfile() {
  const { theme } = usePortalTheme('sdo', getPortalDefaultTheme('sdo'));
  const palette = buildMaintenancePalette(theme);

  return (
    <OfficeProfilePage
      storageKey="sdoProfile"
      heading="SDO Profile"
      maintenancePath="/sdo/settings"
      portalName="SDO"
      positionFallback="Student Disciplinary Officer"
      departmentFallback="Student Disciplinary Office"
      roleFallback="SDO Staff"
      avatarTone={theme.base}
      accountConfig={sdoMaintenanceConfig}
      palette={palette}
      tokenStorageKey="sdoToken"
      responsibilities={[
        'Review applicant disciplinary standing and endorsement queues.',
        'Record SDO endorsement findings and office remarks.',
        'Monitor scholar disciplinary standing and flagged scholar records.',
      ]}
    />
  );
}
