import DepartmentMaintenancePage from '@/components/department/DepartmentMaintenancePage';

const palette = {
  base: '#5f3d8a',
  accent: '#7c3aed',
  bg: '#f8f5fb',
  toggleClass: 'text-violet-600',
  infoBox: 'border-violet-100 bg-violet-50 text-violet-800',
};

const config = {
  shortName: 'PD',
  pageSubtitle: 'Program Director configuration and endorsement maintenance',
  featureTitle: 'Endorsement Review Settings',
  featureLabels: ['Review Window Open', 'Review Window Paused'],
  featureFieldLabel: 'Review Cycle',
  featureFieldDefault: 'Per endorsement batch',
  auditScope: 'PD',
  footerLabel: 'SMaRT PDM · PD Maintenance Layer',
  account: {
    first_name: 'Program',
    last_name: 'Director',
    email: 'pd@pdm.edu.ph',
    phone_number: '+63 917 100 0000',
    position: 'Program Director',
    department: 'Program Director Office',
    role: 'PD Staff',
  },
  auditEntries: [
    {
      action: 'Reviewed endorsement decision settings',
      actor: 'Program Director',
      time: 'Apr 08, 2026 · 11:20 AM',
      status: 'Success',
    },
    {
      action: 'Opened PD endorsement tracker',
      actor: 'Program Director',
      time: 'Apr 08, 2026 · 10:48 AM',
      status: 'Viewed',
    },
    {
      action: 'Saved PD account profile details',
      actor: 'Program Director',
      time: 'Apr 07, 2026 · 04:05 PM',
      status: 'Success',
    },
  ],
};

export default function PDMaintenance() {
  return <DepartmentMaintenancePage config={config} palette={palette} />;
}
