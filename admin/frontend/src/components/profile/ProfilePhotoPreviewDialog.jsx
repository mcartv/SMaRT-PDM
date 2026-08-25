import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';

export default function ProfilePhotoPreviewDialog({ open, onOpenChange, src, name = 'Profile photo' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[80] bg-black/35 backdrop-blur-sm"
        className="z-[90] w-auto max-w-[96vw] border-0 bg-transparent p-0 shadow-none !ring-0 outline-none"
      >
        <DialogTitle className="sr-only">{name} preview</DialogTitle>

        <div className="relative flex items-center justify-center px-10 py-6 sm:px-14 sm:py-8">
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

          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close profile photo preview"
              className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-stone-600 shadow-md transition hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
