import {
  FileSearch,
  AlertTriangle,
  Scale,
  Shield,
} from 'lucide-react';
import OfficeProfilePage from '@/components/profile/OfficeProfilePage';
import usePortalTheme from '@/hooks/usePortalTheme';
import { buildMaintenancePalette, getPortalDefaultTheme } from '@/config/portalThemes';
import { sdoMaintenanceConfig } from '@/pages/SDOMaintenance';

export default function SDOProfile() {
  const { theme } = usePortalTheme('sdo', getPortalDefaultTheme('sdo'));
  const palette = buildMaintenancePalette(theme);

  return (
    <OfficeProfilePage
      storageKey="sdoProfile"
      heading="SDO Profile"
      maintenancePath="/sdo/maintenance"
      portalName="SDO"
      positionFallback="Student Disciplinary Officer"
      departmentFallback="Student Disciplinary Office"
      roleFallback="SDO Staff"
      avatarTone="#2e4b43"
      bio="Handles disciplinary monitoring, probation-related records, scholar case visibility, and endorsement decisions inside the SMaRT-PDM platform."
      accountConfig={sdoMaintenanceConfig}
      palette={palette}
      tokenStorageKey="sdoToken"
      statCards={[
        { label: 'Cases Reviewed', value: '128', icon: FileSearch, tone: 'green' },
        { label: 'Status Updates', value: '47', icon: Scale, tone: 'amber' },
        { label: 'Flagged Cases', value: '9', icon: AlertTriangle, tone: 'red' },
        { label: 'Years Active', value: '2', icon: Shield, tone: 'stone' },
      ]}
      activityLog={[
        { action: 'Updated scholar probation status', time: 'Recent' },
        { action: 'Reviewed disciplinary records', time: 'Today' },
        { action: 'Saved SDO profile settings', time: 'This week' },
        { action: 'Monitored flagged scholar cases', time: 'This week' },
      ]}
    />
  );
}
