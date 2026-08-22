import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const dropdownClass = 'pointer-events-none invisible absolute left-0 top-full z-50 w-64 rounded-b-xl border border-white/15 p-2 opacity-0 shadow-2xl transition group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100';
const itemClass = 'block rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-semibold text-white transition hover:border-[var(--public-accent)] hover:bg-white/10';
const dropdownLinkClass = ({ isActive }) => `${itemClass} ${isActive ? 'border-[var(--public-accent)] bg-white/10' : ''}`;

export default function PublicPageNav({ theme }) {
  const location = useLocation();
  const howToApplyActive = location.pathname.startsWith('/how-to-apply');
  const aboutActive = location.pathname.startsWith('/about');
  useEffect(() => {
    if (!location.hash) return;
    requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.pathname, location.hash]);
  const topClass = 'shrink-0 border-b-2 border-transparent px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white/80 transition hover:border-[var(--public-accent)] hover:text-white';
  return <nav className="sticky top-0 z-50 border-b shadow-md" style={{background:theme.dark,borderBottomColor:theme.accent,'--public-accent':theme.accent,'--public-bg':theme.dark}}><div className="flex items-center overflow-x-auto px-3 sm:px-5 md:overflow-visible md:px-8 lg:px-10">
    <Link to="/landing#home" className={topClass}>Home</Link>
    <Link to="/landing#benefactors" className={topClass}>Benefactors</Link>
    <NavGroup label="How to Apply" theme={theme} active={howToApplyActive}><NavLink className={dropdownLinkClass} to="/how-to-apply/process">Scholarship Process</NavLink><NavLink className={dropdownLinkClass} to="/how-to-apply/requirements">Scholar Requirements</NavLink><NavLink className={dropdownLinkClass} to="/how-to-apply/obligations">Scholar Obligations</NavLink></NavGroup>
    <NavGroup label="About" theme={theme} active={aboutActive}><NavLink className={dropdownLinkClass} to="/about/pdm">About PDM</NavLink><NavLink className={dropdownLinkClass} to="/about/smart-pdm">About SMaRT-PDM</NavLink><NavLink className={dropdownLinkClass} to="/about/developers">About the Developers</NavLink></NavGroup>
    <Link to="/landing#faq" className={topClass}>FAQs</Link>
    <div className="ml-auto shrink-0 border-l border-white/15 pl-2"><Link to="/login" className={topClass}>Login</Link></div>
  </div></nav>;
}

function NavGroup({label,children,theme,active}) { return <div className="group relative shrink-0"><span className={`flex cursor-default items-center gap-1 border-b-2 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] transition group-hover:border-[var(--public-accent)] group-hover:text-white ${active?'border-[var(--public-accent)] bg-white/8 text-white':'border-transparent text-white/80'}`}>{label}<ChevronDown size={14} className="transition group-hover:rotate-180"/></span><div className={dropdownClass} style={{background:theme.dark}}>{children}</div></div>; }
