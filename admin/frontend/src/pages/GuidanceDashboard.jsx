// SMaRT-PDM: Dashboard — Guidance Dashboard (admin frontend page); loads data, handles page actions, and renders the admin view.
import OfficeDashboard from '@/components/endorsement/OfficeDashboard';

export default function GuidanceDashboard() {
  return (
    <OfficeDashboard officeKey="guidance" tokenStorageKey="guidanceToken" />
  );
}
