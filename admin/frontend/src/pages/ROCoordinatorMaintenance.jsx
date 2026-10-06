// SMaRT-PDM: Return of Obligations — ROCoordinator Maintenance (admin frontend page); loads data, handles page actions, and renders the admin view.
import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';

export default function ROCoordinatorMaintenance() {
  return <DepartmentSettingsPage portalKey="ro_coordinator" tokenStorageKey="roCoordinatorToken" profilePath="/ro-coordinator/profile" themeTitle="Theme" themeSubtitle="Choose the appearance used for the Return of Obligation workspace." />;
}
