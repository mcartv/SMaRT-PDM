import PreviewableProfileAvatar from '@/components/profile/PreviewableProfileAvatar';
import { cn } from '@/lib/utils';

function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'S';
}

function resolvePhotoUrl(scholar = {}) {
  return (
    scholar.avatar_url ||
    scholar.avatarUrl ||
    scholar.profile_photo_url ||
    scholar.profilePhotoUrl ||
    ''
  );
}

export default function ScholarIdentity({
  scholar,
  name,
  studentNumber,
  className,
  nameClassName,
  compact = false,
}) {
  const displayName = name || scholar?.student_name || scholar?.name || 'Unknown Scholar';
  const displayNumber = studentNumber || scholar?.student_number || scholar?.pdm_id || 'No PDM ID';

  return (
    <div className={cn('flex min-w-0 items-center', compact ? 'gap-2.5' : 'gap-3', className)}>
      <PreviewableProfileAvatar
        src={resolvePhotoUrl(scholar)}
        name={`${displayName} profile photo`}
        fallback={getInitials(displayName)}
        avatarClassName={cn(
          'shrink-0 rounded-full border border-stone-200 bg-stone-100',
          compact ? 'h-9 w-9' : 'h-10 w-10'
        )}
        imageClassName="rounded-full object-cover"
        fallbackClassName={cn(
          'rounded-full bg-stone-100 font-semibold text-stone-600',
          compact ? 'text-[11px]' : 'text-xs'
        )}
        buttonClassName="rounded-full focus-visible:ring-[var(--portal-base)]"
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-semibold leading-5 text-stone-900',
            nameClassName
          )}
        >
          {displayName}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-stone-400">
          {displayNumber}
        </p>
      </div>
    </div>
  );
}
