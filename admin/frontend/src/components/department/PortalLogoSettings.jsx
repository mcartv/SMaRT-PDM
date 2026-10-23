import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import usePortalLogo from '@/hooks/usePortalLogo';
import pdmLogo from '@/assets/pdm-logo.png';
import { prepareLogo } from '@/utils/prepareLogo';

export default function PortalLogoSettings({ tokenStorageKey, publicLogo = false, disabled = false }) {
  const logo = usePortalLogo(publicLogo ? undefined : tokenStorageKey);
  const input = useRef(null);
  const [busy,setBusy] = useState(false);
  async function save(file) {
    if (file && (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 3*1024*1024)) {
      toast.error('Choose a PNG, JPG, or WebP image up to 3 MB.'); return;
    }
    setBusy(true);
    try {
      const body = file ? new FormData() : undefined;
      if (file) body.append('file',await prepareLogo(file));
      const response = await fetch(buildApiUrl(publicLogo ? '/api/general-settings/logo' : '/api/accounts/me/sidebar-logo'), {
        method:file ? 'PATCH' : 'DELETE', headers:{Authorization:`Bearer ${sessionStorage.getItem(tokenStorageKey) || ''}`}, body,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to save logo.');
      window.dispatchEvent(new CustomEvent('portal-logo:updated',{detail:{key:publicLogo ? 'public' : tokenStorageKey}}));
      toast.success(file ? 'Logo updated.' : 'PDM logo restored.');
    } catch(e) { toast.error(e.message); }
    finally { setBusy(false); if (input.current) input.current.value=''; }
  }
  return <section className="my-4 rounded-2xl border border-stone-200 bg-white p-4">
    <h3 className="text-sm font-semibold">{publicLogo ? 'Landing page logo' : 'Sidebar logo'}</h3>
    <p className="mt-1 text-xs text-stone-500">{publicLogo ? 'Displayed in public landing page headers.' : 'Personalize your sidebar. This applies only to your account.'} The default is the PDM logo.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <img src={logo} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=pdmLogo;}} alt="Current logo" className="h-16 w-16 shrink-0 rounded-lg border bg-stone-50 p-1 object-contain" />
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose logo image" disabled={disabled || busy} onChange={e=>{if(e.target.files?.[0])save(e.target.files[0]);}} />
      <Button type="button" disabled={disabled || busy} onClick={()=>input.current?.click()}>{busy ? 'Saving…' : 'Upload logo'}</Button>
      <Button type="button" variant="outline" disabled={disabled || busy || logo===pdmLogo} onClick={()=>save(null)}>Reset to PDM logo</Button>
    </div>
    <p className="mt-2 text-xs text-stone-500">PNG, JPG, or WebP · Up to 3 MB. Solid backgrounds and extra padding are removed automatically. For complex backgrounds, use a transparent PNG. Changes save immediately.</p>
  </section>;
}
