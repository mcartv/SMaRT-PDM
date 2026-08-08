import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';

// eslint-disable-next-line react-refresh/only-export-components -- shared with the matching profile page
export const pdMaintenanceConfig = {
  shortName: 'PD',
  account: {
    first_name: 'Program',
    last_name: 'Director',
    email: 'pd@pdm.edu.ph',
    phone_number: '',
    position: 'Program Director',
    department: 'Program Director Office',
    role: 'PD Staff',
  },
};

export default function PDMaintenance() {
  return (
    <DepartmentSettingsPage
      portalKey="pd"
      tokenStorageKey="pdToken"
      profilePath="/pd/profile"
      themeTitle="Theme"
      themeSubtitle="Choose the appearance used for the Program Director workspace."
    />
  );
}
