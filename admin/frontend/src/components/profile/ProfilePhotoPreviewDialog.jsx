import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export default function ProfilePhotoPreviewDialog({ open, onOpenChange, src, name = 'Profile photo' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[90vw] border-none bg-transparent p-0 shadow-none [&>button]:right-3 [&>button]:top-3 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:bg-white/92 [&>button]:p-0 [&>button]:text-stone-600 [&>button]:opacity-100 [&>button]:shadow-md [&>button]:ring-0 [&>button]:transition hover:[&>button]:bg-white hover:[&>button]:text-stone-900">
        <DialogTitle className="sr-only">{name} preview</DialogTitle>

        <div className="flex items-center justify-center p-2 sm:p-4">
          {src ? (
            <div className="flex h-[min(78vw,30rem)] w-[min(78vw,30rem)] max-h-[78vh] max-w-[78vh] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-stone-950 shadow-2xl">
              <img
                src={src}
                alt={`${name} preview`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[18rem] w-[18rem] items-center justify-center rounded-full border-4 border-white bg-stone-100 px-6 text-center shadow-2xl">
              <p className="text-sm text-stone-500">No profile photo available.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
