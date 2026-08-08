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
      avatarTone="#2e4b43"
      bio="Handles disciplinary monitoring, probation-related records, scholar case visibility, and endorsement decisions inside the SMaRT-PDM platform."
      accountConfig={sdoMaintenanceConfig}
      palette={palette}
      tokenStorageKey="sdoToken"
      responsibilities={[
        'Review applicant disciplinary records and endorsement queues.',
        'Record offense findings, case references, and office remarks.',
        'Monitor scholar disciplinary standing and flagged cases.',
      ]}
    />
  );
}
