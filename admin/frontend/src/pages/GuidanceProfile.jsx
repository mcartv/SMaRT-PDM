import {
  FileSearch,
  Activity,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import OfficeProfilePage from '@/components/profile/OfficeProfilePage';

export default function GuidanceProfile() {
  return (
    <OfficeProfilePage
      storageKey="guidanceProfile"
      heading="Guidance Profile"
      maintenancePath="/guidance/maintenance"
      portalName="Guidance"
      positionFallback="Guidance Counselor"
      departmentFallback="Guidance Office"
      roleFallback="Guidance Staff"
      avatarTone="#1f4e79"
      bio="Handles moral standing review, counseling holds, and guidance-side endorsement decisions inside the SMaRT-PDM platform."
      statCards={[
        { label: 'Cases Reviewed', value: '96', icon: FileSearch, tone: 'green' },
        { label: 'Counseling Holds', value: '14', icon: AlertTriangle, tone: 'amber' },
        { label: 'Clearances', value: '72', icon: Shield, tone: 'stone' },
        { label: 'Activity Logs', value: '28', icon: Activity, tone: 'green' },
      ]}
      activityLog={[
        { action: 'Reviewed guidance endorsement queue', time: 'Recent' },
        { action: 'Updated counseling hold decision', time: 'Today' },
        { action: 'Saved guidance maintenance settings', time: 'This week' },
        { action: 'Checked moral standing records', time: 'This week' },
      ]}
    />
  );
}
