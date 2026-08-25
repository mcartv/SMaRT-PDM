const STEP_TONES = {
  completed: {
    dot: 'bg-green-600 border-green-600',
    line: 'bg-green-600',
    label: 'text-green-700',
  },
  active: {
    dot: 'bg-blue-600 border-blue-600 ring-4 ring-blue-100',
    line: 'bg-stone-200',
    label: 'text-blue-700',
  },
  pending: {
    dot: 'bg-white border-stone-300',
    line: 'bg-stone-200',
    label: 'text-stone-500',
  },
  stopped: {
    dot: 'bg-red-600 border-red-600',
    line: 'bg-stone-200',
    label: 'text-red-700',
  },
};

function resolveTone(state) {
  return STEP_TONES[state] || STEP_TONES.pending;
}

export default function EndorsementProgressTracker({
  tracker,
  compact = false,
  className = '',
}) {
  if (!tracker?.steps?.length) return null;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Progress Tracker
          </p>
          <p className="mt-1 text-sm font-medium text-stone-800">
            {tracker.current_label || tracker.overall_status_label || 'Pending'}
          </p>
        </div>
        {tracker.overall_status_label ? (
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700">
            {tracker.overall_status_label}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tracker.steps.map((step, index) => {
          const tone = resolveTone(step.state);
          const isLast = index === tracker.steps.length - 1;

          return (
            <div key={step.key} className="min-w-0">
              <div className="flex items-center">
                <div
                  className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${tone.dot}`}
                  aria-hidden="true"
                />
                {!isLast ? (
                  <div
                    className={`ml-2 h-1 flex-1 rounded-full ${step.state === 'completed' ? tone.line : 'bg-stone-200'}`}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className={`mt-2 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
                <p className={`text-xs font-semibold ${tone.label}`}>{step.label}</p>
                <p className="text-[11px] text-stone-500">
                  {step.state === 'active'
                    ? 'In progress'
                    : step.state === 'completed'
                      ? 'Done'
                      : step.state === 'stopped'
                        ? 'Stopped'
                        : 'Waiting'}
                </p>
                {!compact && step.decision ? (
                  <p className="text-[11px] text-stone-400">{step.decision}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
