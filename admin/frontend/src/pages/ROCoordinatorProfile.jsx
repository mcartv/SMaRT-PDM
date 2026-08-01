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
      maintenancePath="/ro-coordinator/maintenance"
      portalName="RO Coordinator"
      positionFallback="RO Coordinator"
      departmentFallback="Assigned RO Area"
      roleFallback="RO Coordinator"
      avatarTone={theme.base}
      bio="Reviews Return of Obligation assignment requests for the assigned department, office, or faculty area."
      accountConfig={roCoordinatorAccountConfig}
      palette={palette}
      tokenStorageKey="roCoordinatorToken"
      responsibilities={[
        'Review Return of Obligation requests for the assigned area.',
        'Coordinate assignment availability and scholar placements.',
        'Monitor acknowledgements, attendance, and completion submissions.',
      ]}
    />
  );
}
