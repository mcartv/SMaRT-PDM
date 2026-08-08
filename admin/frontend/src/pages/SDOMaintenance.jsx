import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';

// eslint-disable-next-line react-refresh/only-export-components -- shared with the matching profile page
export const sdoMaintenanceConfig = {
  shortName: 'SDO',
  account: {
    first_name: 'SDO',
    last_name: 'Officer',
    email: 'sdo@pdm.edu.ph',
    phone_number: '',
    position: 'Student Disciplinary Officer',
    department: 'Student Disciplinary Office',
    role: 'SDO Staff',
  },
};

export default function SDOMaintenance() {
  return (
    <DepartmentSettingsPage
      portalKey="sdo"
      tokenStorageKey="sdoToken"
      profilePath="/sdo/profile"
      themeTitle="Theme"
      themeSubtitle="Choose the appearance used for the Student Discipline Office workspace."
    />
  );
}
