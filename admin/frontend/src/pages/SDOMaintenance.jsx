import DepartmentMaintenancePage from '@/components/department/DepartmentMaintenancePage';

const palette = {
  base: '#2e4b43',
  accent: '#3f655b',
  bg: '#f6f8f7',
  toggleClass: 'text-emerald-600',
  infoBox: 'border-emerald-100 bg-emerald-50 text-emerald-800',
};

const config = {
  shortName: 'SDO',
  pageSubtitle: 'SDO configuration and disciplinary monitoring maintenance',
  featureTitle: 'Disciplinary Monitoring',
  featureLabels: ['Monitoring Active', 'Monitoring Paused'],
  featureFieldLabel: 'Review Cycle',
  featureFieldDefault: 'Weekly',
  auditScope: 'SDO',
  footerLabel: 'SMaRT PDM · SDO Maintenance Layer',
  account: {
    first_name: 'SDO',
    last_name: 'Officer',
    email: 'sdo@pdm.edu.ph',
    phone_number: '+63 917 000 0000',
    position: 'Student Disciplinary Officer',
    department: 'Student Disciplinary Office',
    role: 'SDO Staff',
  },
  auditEntries: [
    {
      action: 'Updated scholar probation status',
      actor: 'SDO Officer',
      time: 'Apr 08, 2026 · 10:15 AM',
      status: 'Success',
    },
    {
      action: 'Saved SDO profile settings',
      actor: 'SDO Officer',
      time: 'Apr 08, 2026 · 09:42 AM',
      status: 'Success',
    },
    {
      action: 'Viewed disciplinary records dashboard',
      actor: 'SDO Officer',
      time: 'Apr 07, 2026 · 03:10 PM',
      status: 'Viewed',
    },
  ],
};

export default function SDOMaintenance() {
  return (
    <DepartmentMaintenancePage
      config={config}
      palette={palette}
      tokenStorageKey="sdoToken"
      profileStorageKey="sdoProfile"
    />
  );
}
