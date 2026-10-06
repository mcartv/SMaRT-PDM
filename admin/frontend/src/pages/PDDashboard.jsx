// SMaRT-PDM: Dashboard — PDDashboard (admin frontend page); loads data, handles page actions, and renders the admin view.
import OfficeDashboard from '@/components/endorsement/OfficeDashboard';

export default function PDDashboard() {
  return (
    <OfficeDashboard officeKey="pd" tokenStorageKey="pdToken" />
  );
}
