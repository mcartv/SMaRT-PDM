import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const dropdownClass = 'pointer-events-none invisible absolute left-0 top-full z-50 w-64 rounded-b-xl border border-white/15 p-2 opacity-0 shadow-2xl transition group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100';
const itemClass = 'block rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-semibold text-white transition hover:border-[var(--public-accent)] hover:bg-white/10 focus:outline-none focus-visible:border-[var(--public-accent)] focus-visible:bg-white/10';
const dropdownLinkClass = ({ isActive }) => `${itemClass} ${isActive ? 'border-[var(--public-accent)] bg-white/10' : ''}`;
const mobileBaseClass = 'shrink-0 snap-start border-b-2 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.07em] transition focus:outline-none focus-visible:bg-white/10';
const mobileNavClass = ({ isActive }) => `${mobileBaseClass} ${isActive ? 'border-[var(--public-accent)] text-white' : 'border-transparent text-white/75 hover:border-[var(--public-accent)] hover:text-white'}`;

export default function PublicPageNav({ theme }) {
  const location = useLocation();
  const howToApplyActive = location.pathname.startsWith('/how-to-apply');
  const aboutActive = location.pathname.startsWith('/about');

  useEffect(() => {
    if (!location.hash) return;
    requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.pathname, location.hash]);

  const topClass = 'shrink-0 border-b-2 border-transparent px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white/80 transition hover:border-[var(--public-accent)] hover:text-white focus:outline-none focus-visible:border-[var(--public-accent)] focus-visible:text-white';

  return (
    <nav
      className="public-responsive-nav sticky top-0 z-50 border-b shadow-md"
      style={{
        background: theme.dark,
        borderBottomColor: theme.accent,
        '--public-accent': theme.accent,
        '--public-bg': theme.dark,
      }}
      aria-label="Public navigation"
    >
      <div className="md:hidden">
        <div className="flex snap-x snap-mandatory items-center overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link to="/landing#home" className={`${mobileBaseClass} border-transparent text-white/75 hover:border-[var(--public-accent)] hover:text-white`}>Home</Link>
          <Link to="/landing#benefactors" className={`${mobileBaseClass} border-transparent text-white/75 hover:border-[var(--public-accent)] hover:text-white`}>Benefactors</Link>
          <NavLink className={mobileNavClass} to="/how-to-apply/process">Process</NavLink>
          <NavLink className={mobileNavClass} to="/how-to-apply/requirements">Requirements</NavLink>
          <NavLink className={mobileNavClass} to="/how-to-apply/obligations">Obligations</NavLink>
          <NavLink className={mobileNavClass} to="/about/pdm">About PDM</NavLink>
          <NavLink className={mobileNavClass} to="/about/smart-pdm">SMaRT-PDM</NavLink>
          <NavLink className={mobileNavClass} to="/about/developers">Developers</NavLink>
          <Link to="/landing#faq" className={`${mobileBaseClass} border-transparent text-white/75 hover:border-[var(--public-accent)] hover:text-white`}>FAQs</Link>
          <Link to="/login" className={`${mobileBaseClass} border-transparent text-white/75 hover:border-[var(--public-accent)] hover:text-white`}>Login</Link>
        </div>
      </div>

      <div className="hidden items-center px-5 md:flex md:px-8 lg:px-10">
        <Link to="/landing#home" className={topClass}>Home</Link>
        <Link to="/landing#benefactors" className={topClass}>Benefactors</Link>
        <NavGroup label="How to Apply" theme={theme} active={howToApplyActive}>
          <NavLink className={dropdownLinkClass} to="/how-to-apply/process">Scholarship Process</NavLink>
          <NavLink className={dropdownLinkClass} to="/how-to-apply/requirements">Scholar Requirements</NavLink>
          <NavLink className={dropdownLinkClass} to="/how-to-apply/obligations">Scholar Obligations</NavLink>
        </NavGroup>
        <NavGroup label="About" theme={theme} active={aboutActive}>
          <NavLink className={dropdownLinkClass} to="/about/pdm">About PDM</NavLink>
          <NavLink className={dropdownLinkClass} to="/about/smart-pdm">About SMaRT-PDM</NavLink>
          <NavLink className={dropdownLinkClass} to="/about/developers">About the Developers</NavLink>
        </NavGroup>
        <Link to="/landing#faq" className={topClass}>FAQs</Link>
        <div className="ml-auto shrink-0 border-l border-white/15 pl-2">
          <Link to="/login" className={topClass}>Login</Link>
        </div>
      </div>
    </nav>
  );
}

function NavGroup({ label, children, theme, active }) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        className={`flex items-center gap-1 border-b-2 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] transition group-hover:border-[var(--public-accent)] group-hover:text-white focus:outline-none focus-visible:border-[var(--public-accent)] focus-visible:text-white ${active ? 'border-[var(--public-accent)] bg-white/8 text-white' : 'border-transparent text-white/80'}`}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown size={14} className="transition group-hover:rotate-180 group-focus-within:rotate-180" />
      </button>
      <div className={dropdownClass} style={{ background: theme.dark }}>
        {children}
      </div>
    </div>
  );
}
