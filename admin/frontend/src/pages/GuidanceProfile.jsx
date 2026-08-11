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
      departmentFallback="Guidance Office"
      roleFallback="Guidance Officer"
      avatarTone="#1f4e79"
      bio="Handles moral standing review, counseling holds, and guidance-side endorsement decisions inside the SMaRT-PDM platform."
      accountConfig={guidanceMaintenanceConfig}
      palette={palette}
      tokenStorageKey="guidanceToken"
      responsibilities={[
        'Review applicant moral-standing and counseling records.',
        'Issue clearances, holds, or rejection decisions with remarks.',
        'Track endorsement progress after SDO review.',
      ]}
    />
  );
}
