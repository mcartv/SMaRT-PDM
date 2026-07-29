import ThemePanel from '@/pages/maintenance/ThemePanel';

export default function ROCoordinatorMaintenance() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">Personalize the appearance of your RO Coordinator portal.</p>
      </div>
      <ThemePanel
        tokenStorageKey="roCoordinatorToken"
        allowedPortals={['ro_coordinator']}
        editablePortals={['ro_coordinator']}
        title="RO Coordinator Theme"
        subtitle="Choose a personal color preset for your dashboard and request queue."
      />
    </div>
  );
}
