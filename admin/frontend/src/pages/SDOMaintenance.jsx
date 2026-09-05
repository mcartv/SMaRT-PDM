import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';


export const sdoMaintenanceConfig = {
  shortName: 'SDO',
  account: {
    first_name: 'SDO',
    last_name: 'Officer',
    email: 'sdo@pdm.edu.ph',
    phone_number: '',
    position: 'Student Disciplinary Officer',
    department: 'Student Disciplinary Office',
    role: 'SDO User',
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
