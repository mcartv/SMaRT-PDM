import OfficeProfilePage from '@/components/profile/OfficeProfilePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';

const roCoordinatorAccountConfig = {
  shortName: 'RO Coordinator',
  lockIdentityFields: true,
  account: {
    first_name: 'RO',
    last_name: 'Coordinator',
    email: 'ro.coordinator@pdm.edu.ph',
    phone_number: '',
    position: 'RO Coordinator',
    department: 'Assigned RO Area',
    role: 'RO Coordinator',
  },
};

export default function ROCoordinatorProfile() {
  const { theme } = usePortalTheme('ro_coordinator', getPortalDefaultTheme('ro_coordinator'));
  const palette = buildMaintenancePalette(theme);

  return (
    <OfficeProfilePage
      storageKey="roCoordinatorProfile"
      heading="RO Coordinator Profile"
      maintenancePath="/ro-coordinator/settings"
      portalName="RO Coordinator"
      positionFallback="RO Coordinator"
      departmentFallback="Assigned RO Area"
      roleFallback="RO Coordinator"
      avatarTone={theme.base}
      accountConfig={roCoordinatorAccountConfig}
      palette={palette}
      tokenStorageKey="roCoordinatorToken"
      responsibilities={[
        'Review placement approval requests for the assigned RO area.',
        'Coordinate scholar placement availability with Admin.',
        'Validate attendance evidence and monitor assigned scholars.',
      ]}
    />
  );
}
