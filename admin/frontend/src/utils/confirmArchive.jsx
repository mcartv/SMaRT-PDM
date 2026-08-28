import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Archive } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function ArchiveConfirmation({ itemName, description, finish }) {
  const [open, setOpen] = useState(true);
  const closingRef = useRef(false);

  const close = (confirmed) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    window.setTimeout(() => finish(confirmed), 120);
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && close(false)}>
      <AlertDialogContent className="gap-0 rounded-2xl p-0 sm:max-w-md">
        <AlertDialogHeader className="gap-1.5 border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertDialogMedia className="size-9 rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-base)] *:[svg]:size-4">
              <Archive />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-base font-semibold text-stone-900">Archive item?</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {description || `“${itemName || 'This item'}” will move to Archived and will no longer appear with active records.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="px-5 py-4">
          <AlertDialogCancel
            className="h-9 rounded-lg border-stone-200 px-4 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-[var(--portal-accent-soft)]"
            onClick={() => close(false)}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-9 rounded-lg border-none bg-[var(--portal-base)] px-4 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] focus-visible:ring-offset-2 active:translate-y-px"
            onClick={() => close(true)}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function confirmArchive({ itemName = '', description = '' } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.dataset.archiveConfirmationHost = 'true';
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;

    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      root.unmount();
      host.remove();
      resolve(confirmed);
    };

    root.render(<ArchiveConfirmation itemName={itemName} description={description} finish={finish} />);
  });
}
