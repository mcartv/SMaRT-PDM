// SMaRT-PDM: Dashboard — SDODashboard (admin frontend page); loads data, handles page actions, and renders the admin view.
import OfficeDashboard from '@/components/endorsement/OfficeDashboard';

export default function SDODashboard() {
  return (
    <OfficeDashboard officeKey="sdo" tokenStorageKey="sdoToken" />
  );
}
