// SMaRT-PDM: Community Service — ROCoordinator Profile (admin frontend page); loads data, handles page actions, and renders the admin view.
import OfficeProfilePage from '@/components/profile/OfficeProfilePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';

const roCoordinatorAccountConfig = {
  shortName: 'Community Service Personnel-In-Charge',
  lockIdentityFields: true,
  account: {
    first_name: 'RO',
    last_name: 'Personnel-In-Charge',
    email: 'ro.coordinator@pdm.edu.ph',
    phone_number: '',
    position: 'RO Personnel-In-Charge',
    department: 'Assigned Community Service Area',
    role: 'RO Personnel-In-Charge',
  },
};

export default function ROCoordinatorProfile() {
  const { theme } = usePortalTheme('ro_coordinator', getPortalDefaultTheme('ro_coordinator'));
  const palette = buildMaintenancePalette(theme);

  return (
    <OfficeProfilePage
      storageKey="roCoordinatorProfile"
      heading="Community Service Personnel-In-Charge Profile"
      maintenancePath="/ro-coordinator/settings"
      portalName="Community Service Personnel-In-Charge"
      positionFallback="Community Service Personnel-In-Charge"
      departmentFallback="Not assigned"
      roleFallback="ro_coordinator"
      avatarTone={theme.base}
      accountConfig={roCoordinatorAccountConfig}
      palette={palette}
      tokenStorageKey="roCoordinatorToken"
      responsibilities={[
        'Review placement approval requests for the assigned Community Service area.',
        'Coordinate scholar placement availability with OSFA.',
        'Validate attendance evidence and monitor assigned scholars.',
      ]}
    />
  );
}
