import EndorsementQueue from './EndorsementQueue';

export default function GuidanceDashboard() {
  return (
    <EndorsementQueue
      queueKey="guidance"
      tokenStorageKey="guidanceToken"
      profileStorageKey="guidanceProfile"
      detailBasePath="/guidance/endorsements"
    />
  );
}
