import EndorsementQueue from './EndorsementQueue';

export default function PDDashboard() {
  return (
    <EndorsementQueue
      queueKey="pd"
      tokenStorageKey="pdToken"
      profileStorageKey="pdProfile"
      detailBasePath="/pd/endorsements"
    />
  );
}
