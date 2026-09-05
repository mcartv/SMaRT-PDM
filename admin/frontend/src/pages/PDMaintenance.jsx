import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';


export const pdMaintenanceConfig = {
  shortName: 'PD',
  account: {
    first_name: 'Program',
    last_name: 'Director',
    email: 'pd@pdm.edu.ph',
    phone_number: '',
    position: 'Program Director',
    department: 'Program Director Office',
    role: 'Program Director',
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
