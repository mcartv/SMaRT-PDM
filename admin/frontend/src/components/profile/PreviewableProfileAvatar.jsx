import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProfilePhotoPreviewDialog from '@/components/profile/ProfilePhotoPreviewDialog';
import { cn } from '@/lib/utils';

export default function PreviewableProfileAvatar({
  src,
  name = 'Profile photo',
  fallback = '',
  avatarClassName,
  imageClassName,
  fallbackClassName,
  buttonClassName,
  onImageError,
  stopPropagation = true,
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const hasPhoto = Boolean(normalizedSrc) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
    setPreviewOpen(false);
  }, [normalizedSrc]);

  const avatar = (
    <Avatar className={avatarClassName}>
      <AvatarImage
        src={hasPhoto ? normalizedSrc : undefined}
        alt={name}
        className={imageClassName}
        onError={(event) => {
          setImageFailed(true);
          onImageError?.(event);
        }}
      />
      <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
    </Avatar>
  );

  if (!hasPhoto) return avatar;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          if (stopPropagation) event.stopPropagation();
          setPreviewOpen(true);
        }}
        className={cn(
          'shrink-0 rounded-full outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
          buttonClassName
        )}
        aria-label={`Enlarge ${name}`}
        title="Preview profile photo"
      >
        {avatar}
      </button>

      <ProfilePhotoPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        src={normalizedSrc}
        name={name}
      />
    </>
  );
}
