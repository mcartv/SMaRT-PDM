import {
  FileSearch,
  Activity,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import OfficeProfilePage from '@/components/profile/OfficeProfilePage';

export default function PDProfile() {
  return (
    <OfficeProfilePage
      storageKey="pdProfile"
      heading="Program Director Profile"
      maintenancePath="/pd/maintenance"
      portalName="Program Director"
      positionFallback="Program Director"
      departmentFallback="Program Director Office"
      roleFallback="PD Staff"
      avatarTone="#5f3d8a"
      bio="Handles final endorsement review, academic standing confirmation, and program-side approval decisions inside the SMaRT-PDM platform."
      statCards={[
        { label: 'Endorsements', value: '88', icon: FileSearch, tone: 'green' },
        { label: 'Final Reviews', value: '36', icon: Shield, tone: 'stone' },
        { label: 'Returned Cases', value: '7', icon: AlertTriangle, tone: 'amber' },
        { label: 'Activity Logs', value: '24', icon: Activity, tone: 'green' },
      ]}
      activityLog={[
        { action: 'Reviewed PD endorsement queue', time: 'Recent' },
        { action: 'Finalized scholastic standing review', time: 'Today' },
        { action: 'Saved PD maintenance settings', time: 'This week' },
        { action: 'Checked endorsement completion records', time: 'This week' },
      ]}
    />
  );
}
