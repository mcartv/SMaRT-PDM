import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';

export default function ROCoordinatorMaintenance() {
  return <DepartmentSettingsPage portalKey="ro_coordinator" tokenStorageKey="roCoordinatorToken" profilePath="/ro-coordinator/profile" themeTitle="Theme" themeSubtitle="Choose the appearance used for the RO Coordinator workspace." />;
}
