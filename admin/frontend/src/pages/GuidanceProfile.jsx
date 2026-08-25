import OfficeProfilePage from '@/components/profile/OfficeProfilePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';
import { guidanceMaintenanceConfig } from '@/pages/GuidanceMaintenance';

export default function GuidanceProfile() {
  const { theme } = usePortalTheme('guidance', getPortalDefaultTheme('guidance'));
  const palette = buildMaintenancePalette(theme);

  return (
    <OfficeProfilePage
      storageKey="guidanceProfile"
      heading="Guidance Profile"
      maintenancePath="/guidance/settings"
      portalName="Guidance"
      positionFallback="Guidance Counselor"
      departmentFallback="Guidance and Counselling Office"
      roleFallback="Guidance Officer"
      avatarTone={theme.base}
      accountConfig={guidanceMaintenanceConfig}
      palette={palette}
      tokenStorageKey="guidanceToken"
      responsibilities={[
        'Review applicants forwarded by SDO for Guidance endorsement.',
        'Confirm Good Moral Standing with optional office remarks.',
        'Track endorsed applicants as they proceed to Program Director review.',
      ]}
    />
  );
}
