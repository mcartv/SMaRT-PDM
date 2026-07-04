import EndorsementQueue from './EndorsementQueue';

export default function SDODashboard() {
  return (
    <EndorsementQueue
      queueKey="sdo"
      tokenStorageKey="sdoToken"
      profileStorageKey="sdoProfile"
      detailBasePath="/sdo/endorsements"
    />
  );
}
