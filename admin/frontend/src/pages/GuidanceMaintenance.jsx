import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';

// eslint-disable-next-line react-refresh/only-export-components -- shared with the matching profile page
export const guidanceMaintenanceConfig = {
  shortName: 'Guidance',
  account: {
    first_name: 'Guidance',
    last_name: 'Counselor',
    email: 'guidance@pdm.edu.ph',
    phone_number: '',
    position: 'Guidance Counselor',
    department: 'Guidance and Counselling Office',
    role: 'Guidance Officer',
  },
};

export default function GuidanceMaintenance() {
  return (
    <DepartmentSettingsPage
      portalKey="guidance"
      tokenStorageKey="guidanceToken"
      profilePath="/guidance/profile"
      themeTitle="Theme"
      themeSubtitle="Choose the appearance used for the Guidance and Counselling Office workspace."
    />
  );
}
