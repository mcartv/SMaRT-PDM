import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  Bell,
  ChevronDown,
  Database,
  Phone,
  Download,
  FileCheck2,
  FileText,
  MapPin,
  Clock3,
  Globe2,
  HelpCircle,
  LockKeyhole,
  Mail,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import useLandingTheme from '@/hooks/useLandingTheme';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { DEFAULT_LANDING_CONTENT, mergeLandingContent } from '@/constants/landingContent';
import { DEFAULT_POLICY_CONTENT, mergePolicyContent } from '@/constants/policyContent';

import pdmLogo from '../assets/pdm-logo.png';
import pdmFacade from '../assets/PDM-Facade.png';
import marilaoLogo from '../assets/MARILAO LOGO.png';
import bcPackagingLogo from '../assets/BC PACKAGING.png';
import foodCraftersLogo from '../assets/FOOD CRAFTERS.png';
import kaizenFoundationLogo from '../assets/KAIZEN FOUNDATION.png';
import pusongMapagkalingaLogo from '../assets/PUSONG MAPAGKALINGA.jpg';

const APP_DOWNLOAD_URL =
  'https://www.mediafire.com/file/8157hvb8nuqiprf/SMaRT_PDM.apk/file';
const PDM_FACEBOOK_URL = 'https://www.facebook.com/PDM2010Official';

const portalLinks = [
  { label: 'Admin', href: '/admin/login' },
  { label: 'SDO', href: '/sdo/login' },
  { label: 'Guidance', href: '/guidance/login' },
  { label: 'Program Director', href: '/pd/login' },
];

function normalizePublicFaqItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.is_archived !== true)
    .map((item) => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    }))
    .filter((item) => item.question && item.answer);
}

const featureIcons = [FileCheck2, Bell, MessageSquare, LockKeyhole];
const benefactorLogos = {
  'bc packaging': { src: bcPackagingLogo, scale: 1 },
  'food crafters': { src: foodCraftersLogo, scale: 0.9 },
  'kaizen foundation': { src: kaizenFoundationLogo, scale: 0.92 },
  'pusong mapagkalinga': { src: pusongMapagkalingaLogo, scale: 1.7 },
};

const defaultFaqItems = [
  {
    question: 'Who can apply?',
    answer:
      'Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process.',
  },
  {
    question: 'What documents are required?',
    answer:
      'Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review.',
  },
  {
    question: 'How does endorsement work?',
    answer:
      'The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed.',
  },
  {
    question: 'When does scholar activation happen?',
    answer:
      'Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness.',
  },
];

function isExternalUrl(href) {
  return /^https?:\/\//i.test(href);
}

function isSafePublicLink(href) {
  const value = String(href || '').trim();
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function Button({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  theme,
}) {
  const external = isExternalUrl(href);

  const sizeClass =
    size === 'sm'
      ? 'px-3.5 py-2 text-xs rounded-lg'
      : 'px-4 py-2.5 text-sm rounded-xl';

  const widthClass = fullWidth ? 'w-full' : '';

  const variantClass =
    variant === 'primary'
      ? 'text-white shadow-lg hover:brightness-95'
      : variant === 'ghost'
        ? 'border border-white/15 bg-white/8 text-white hover:bg-white/12'
        : 'border bg-white hover:brightness-[0.98]';

  const style =
    variant === 'primary'
      ? { background: theme?.base || '#7c4a2e' }
      : variant === 'secondary'
        ? {
            borderColor: theme?.border || '#e9dcc8',
            color: theme?.base || '#7c4a2e',
            background: '#ffffff',
          }
        : undefined;

  const content = (
    <>
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </>
  );

  const className = `inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] ${sizeClass} ${widthClass} ${variantClass}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={href} className={className} style={style}>
      {content}
    </Link>
  );
}

function FeatureCard({ icon: Icon, title, description, theme }) {
  return (
    <div className="landing-interactive-card h-full rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: theme.soft, color: theme.base }}
      >
        {React.createElement(Icon, { size: 19 })}
      </div>

      <h3 className="text-sm font-bold text-stone-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description, theme }) {
  return (
    <div className="landing-interactive-card flex h-full flex-col rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
      <div
        className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ background: theme.soft, color: theme.base }}
      >
        Step {step}
      </div>

      <h3 className="mt-4 text-base font-bold text-stone-900">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

function BenefactorCard({ benefactor, theme }) {
  const normalizedName = String(benefactor.benefactor_name || '').trim().toLowerCase();
  const logo = benefactorLogos[normalizedName];

  return (
    <div
      className="h-full rounded-[1.5rem] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: theme.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white p-1.5"
            aria-label={`${benefactor.benefactor_name} logo`}
          >
            {logo ? (
              <img
                src={logo.src}
                alt={`${benefactor.benefactor_name} logo`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
                style={{ transform: `scale(${logo.scale})` }}
              />
            ) : (
              <UserRound size={24} strokeWidth={1.5} className="text-stone-400" aria-label="No profile image available" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-900">{benefactor.benefactor_name}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              {benefactor.benefactor_type || 'Benefactor'}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: theme.soft, color: theme.base }}
        >
          Benefactor
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-500">
        {benefactor.description || 'Supports scholarship opportunities and student access through OSFA programs.'}
      </p>
    </div>
  );
}

function FaqCard({ item, theme, isOpen, onToggle, panelId }) {
  return (
    <div
      className="rounded-[1.5rem] border bg-white p-5 shadow-sm"
      style={{ borderColor: theme.border }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 text-left"
      >
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: theme.soft, color: theme.base }}
        >
          <HelpCircle size={18} />
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-bold text-stone-900">{item.question}</h3>
        </div>

        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-500"
          aria-hidden="true"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen ? (
        <div id={panelId} className="landing-faq-answer ml-12 mt-3 border-t border-stone-100 pt-3">
          <p className="text-sm leading-6 text-stone-500">{item.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

function PolicyModal({ type, content, theme, onClose }) {
  const isPrivacy = type === 'privacy';
  const isTerms = type === 'terms';
  const title = isPrivacy ? 'Privacy Notice' : isTerms ? 'Terms of Use' : content.consent_title;
  const intro = isPrivacy ? content.privacy_intro : isTerms ? content.terms_intro : content.consent_body;
  const sections = isPrivacy ? content.privacy_sections : isTerms ? content.terms_sections : [];
  const Icon = isPrivacy ? ShieldCheck : isTerms ? FileText : Database;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-modal-title"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 px-5 py-5 text-white md:px-7" style={{ background: theme.dark }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: theme.accent, color: theme.dark }}>
              <Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">OSFA Public Information</p>
              <h2 id="policy-modal-title" className="mt-1 text-xl font-bold md:text-2xl">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label={`Close ${title}`}
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-6 md:px-7">
          <p className="text-sm leading-7 text-stone-600">{intro}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: theme.danger }}>
            Effective {content.effective_date}
          </p>

          {sections.length ? (
            <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
              {sections.map((section) => (
                <section key={section.title} className="py-5">
                  <h3 className="text-sm font-bold text-stone-900 md:text-base">{section.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-600">{section.body}</p>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-6 border-t border-stone-200 pt-5">
              <p className="whitespace-pre-line text-sm leading-7 text-stone-600">{content.consent_note}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RequirementsModal({ content, theme, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="requirements-modal-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 px-5 py-5 text-white md:px-7" style={{ background: theme.dark }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: theme.accent, color: theme.dark }}>
              <FileCheck2 size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Applicant Checklist</p>
              <h2 id="requirements-modal-title" className="mt-1 text-xl font-bold md:text-2xl">
                {content.requirements_title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close application requirements"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-6 md:px-7">
          <p className="max-w-3xl text-sm leading-7 text-stone-600">
            {content.requirements_description}
          </p>

          <div className="mt-6 grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: theme.base }}>
                Required documents
              </h3>
              <ol className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                {content.requirement_items.map((item, index) => (
                  <li key={`${index}-${item}`} className="flex gap-3 py-3.5 text-sm leading-6 text-stone-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: theme.soft, color: theme.base }}>
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="rounded-xl p-5" style={{ background: theme.soft }}>
              <div className="flex items-center gap-2" style={{ color: theme.dark }}>
                <ShieldCheck size={18} aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-[0.16em]">Important notices</h3>
              </div>
              <ul className="mt-3 space-y-3">
                {content.requirement_notices.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-6 text-stone-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: theme.danger }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SmartPDMLanding() {
  const { theme } = useLandingTheme();
  const [benefactors, setBenefactors] = useState([]);
  const [activeFaq, setActiveFaq] = useState(-1);
  const [activeSection, setActiveSection] = useState('home');
  const [activePolicy, setActivePolicy] = useState(null);
  const [showRequirements, setShowRequirements] = useState(false);
  const [policyContent, setPolicyContent] = useState(DEFAULT_POLICY_CONTENT);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    office_name: 'Office for Scholarship and Financial Assistance',
    office_email: 'osfa@pdm.edu.ph',
    office_address: 'Abangan Norte, Marilao, Bulacan',
    landline_number: '(044) 919-8191',
    office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
    about_osfa:
      'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.',
    eligibility_summary:
      'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.',
    landing_content: DEFAULT_LANDING_CONTENT,
    featured_notice: null,
    featured_notice_next_change_at: null,
    landing_faqs: defaultFaqItems,
  });
  const hasFeaturedNotice = Boolean(generalSettings.featured_notice);
  const navigationItems = [
    ['Home', '#home'],
    ...(benefactors.length ? [['Benefactors', '#benefactors']] : []),
    ['Guide', '#guide'],
    ['About', '#about'],
    ['FAQ', '#faq'],
    ['Contact', '#contact'],
  ];

  useEffect(() => {
    let active = true;

    const loadBenefactors = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/benefactors/public'));
        const payload = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error('Failed to load benefactors');
        }

        if (active) {
          setBenefactors(Array.isArray(payload) ? payload.slice(0, 6) : []);
        }
      } catch {
        if (active) {
          setBenefactors([]);
        }
      }
    };

    loadBenefactors();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title = 'SMaRT-PDM';
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 640);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const sectionIds = ['home', 'benefactors', 'guide', 'about', 'faq', 'contact'];
    let frameId;

    const updateActiveSection = () => {
      frameId = undefined;
      const activationLine = 120;
      let currentSection = 'home';

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= activationLine) {
          currentSection = id;
        }
      });

      const reachedPageEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
      setActiveSection(reachedPageEnd ? 'contact' : currentSection);
    };

    const handleScroll = () => {
      if (frameId !== undefined) return;
      frameId = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    };
  }, [benefactors.length, generalSettings.landing_faqs.length]);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll(
        '.landing-page > section:not(.landing-hero), .landing-page > main > section, .landing-page > footer'
      )
    );

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach((section) => section.classList.add('landing-reveal-visible'));
      return undefined;
    }

    sections.forEach((section, index) => {
      section.classList.add('landing-reveal');
      section.style.setProperty('--landing-reveal-delay', `${Math.min(index % 3, 2) * 70}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('landing-reveal-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px' }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [benefactors.length, hasFeaturedNotice]);

  useEffect(() => {
    let active = true;

    const loadGeneralSettings = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/general-settings/public'));
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load general settings');
        }

        if (active) {
          setPolicyContent(mergePolicyContent(payload?.policy_content));
          setGeneralSettings((current) => ({
            ...current,
            office_name: payload?.office_name || current.office_name,
            office_email: payload?.office_email || current.office_email,
            office_address: payload?.office_address || current.office_address,
            landline_number: payload?.landline_number || current.landline_number,
            office_hours: payload?.office_hours || current.office_hours,
            about_osfa: payload?.about_osfa || current.about_osfa,
            eligibility_summary: payload?.eligibility_summary || current.eligibility_summary,
            landing_content: mergeLandingContent(payload?.landing_content),
            featured_notice: payload?.featured_notice || null,
            featured_notice_next_change_at: payload?.featured_notice_next_change_at || null,
            landing_faqs: Array.isArray(payload?.landing_faqs)
              ? normalizePublicFaqItems(payload.landing_faqs)
              : current.landing_faqs,
          }));
        }
      } catch {
        if (active) {
          setGeneralSettings((current) => ({ ...current }));
        }
      }
    };

    loadGeneralSettings();

    return () => {
      active = false;
    };
  }, []);

  useSocketEvent(
    'maintenance:updated',
    (payload) => {
      if (payload?.source !== 'general_settings') return;
      const settings = payload?.settings || {};
      if (settings?.policy_content) {
        setPolicyContent(mergePolicyContent(settings.policy_content));
      }
      setGeneralSettings((current) => ({
        ...current,
        office_name: settings?.office_name || current.office_name,
        office_email: settings?.office_email || current.office_email,
        office_address: settings?.office_address || current.office_address,
        landline_number: settings?.landline_number || current.landline_number,
        office_hours: settings?.office_hours || current.office_hours,
        about_osfa: settings?.about_osfa || current.about_osfa,
        eligibility_summary: settings?.eligibility_summary || current.eligibility_summary,
        landing_content: mergeLandingContent(settings?.landing_content),
        featured_notice:
          Object.prototype.hasOwnProperty.call(settings, 'featured_notice')
            ? settings.featured_notice
            : current.featured_notice,
        featured_notice_next_change_at:
          Object.prototype.hasOwnProperty.call(settings, 'featured_notice_next_change_at')
            ? settings.featured_notice_next_change_at
            : current.featured_notice_next_change_at,
        landing_faqs: Array.isArray(settings?.landing_faqs)
          ? normalizePublicFaqItems(settings.landing_faqs)
          : current.landing_faqs,
      }));
    },
    []
  );

  useEffect(() => {
    const boundary = Date.parse(generalSettings.featured_notice_next_change_at || '');
    if (!Number.isFinite(boundary)) return undefined;

    let timeoutId;
    let cancelled = false;
    const maxTimeout = 2147483000;

    const scheduleBoundaryRefresh = () => {
      const remaining = Math.max(0, boundary - Date.now()) + 500;
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (remaining > maxTimeout) {
          scheduleBoundaryRefresh();
          return;
        }

        try {
          const response = await fetch(buildApiUrl('/api/general-settings/public'));
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return;

          setGeneralSettings((current) => ({
            ...current,
            featured_notice: payload?.featured_notice || null,
            featured_notice_next_change_at: payload?.featured_notice_next_change_at || null,
          }));
        } catch {
          // The next socket update or page visit will retry public settings.
        }
      }, Math.min(remaining, maxTimeout));
    };

    scheduleBoundaryRefresh();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [generalSettings.featured_notice_next_change_at]);

  return (
    <div
      className="landing-page min-h-screen text-stone-900"
      style={{ background: theme.pageBg, fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        html {
          scroll-behavior: smooth;
          scroll-padding-top: 4.25rem;
        }
        @keyframes landing-hero-enter {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-panel-enter {
          from { opacity: 0; transform: translateX(28px) scale(0.985); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes landing-faq-expand {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-hero-copy {
          animation: landing-hero-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .landing-hero-panel {
          animation: landing-panel-enter 800ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .landing-interactive-card {
          transition: transform 280ms ease, box-shadow 280ms ease, border-color 280ms ease;
        }
        .landing-interactive-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(55, 35, 20, 0.08);
          border-color: ${theme.accent}88;
        }
        .landing-faq-answer {
          animation: landing-faq-expand 220ms ease-out both;
        }
        .landing-reveal {
          opacity: 0;
          transform: translateY(26px);
          transition:
            opacity 650ms ease var(--landing-reveal-delay, 0ms),
            transform 650ms cubic-bezier(0.22, 1, 0.36, 1) var(--landing-reveal-delay, 0ms);
        }
        .landing-reveal.landing-reveal-visible,
        .landing-reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }
          .landing-hero-copy,
          .landing-hero-panel,
          .landing-faq-answer {
            animation: none;
          }
          .landing-interactive-card {
            transition: none;
          }
          .landing-interactive-card:hover {
            transform: none;
          }
          .landing-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
        .landing-zone-discover,
        .landing-zone-process,
        .landing-zone-bridge,
        .landing-zone-support {
          position: relative;
          isolation: isolate;
          box-shadow: 0 0 0 100vmax var(--zone-background);
          clip-path: inset(0 -100vmax);
          border-top: 1px solid ${theme.accent}38;
        }
        .landing-zone-discover {
          --zone-background: #fbf7eb;
          background:
            radial-gradient(circle at 92% 8%, ${theme.accent}12 0, transparent 22%),
            linear-gradient(180deg, #fffaf0 0%, #fbf7eb 100%);
        }
        .landing-zone-process {
          --zone-background: #fffdf9;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, transparent 48%),
            #fffdf9;
        }
        .landing-zone-bridge {
          --zone-background: #f7f3ec;
          background:
            radial-gradient(circle at 6% 90%, ${theme.base}0d 0, transparent 22%),
            linear-gradient(135deg, #faf7f1 0%, #f7f3ec 100%);
        }
        .landing-zone-notice {
          background:
            linear-gradient(180deg, ${theme.dark}10 0%, transparent 72%),
            ${theme.pageBg};
          box-shadow: 0 0 0 100vmax ${theme.pageBg};
          clip-path: inset(0 -100vmax);
        }
        .landing-highlight-card {
          background: rgba(255, 255, 255, 0.82);
          border-color: ${theme.border};
          backdrop-filter: blur(8px);
          transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
        }
        .landing-highlight-card:hover {
          transform: translateY(-2px);
          border-color: ${theme.base}42;
          box-shadow: 0 12px 30px -24px ${theme.dark}55;
        }
        .landing-zone-support {
          --zone-background: #f7f4ef;
          background:
            radial-gradient(ellipse at 96% 4%, ${theme.accent}0d 0, transparent 24%),
            linear-gradient(180deg, #faf8f4 0%, #f7f4ef 100%);
        }
        .landing-zone-support::before {
          content: none;
        }
        .landing-zone-discover .shadow-sm,
        .landing-zone-process .shadow-sm,
        .landing-zone-bridge .shadow-sm,
        .landing-zone-support .shadow-sm {
          box-shadow: 0 5px 18px rgba(72, 44, 25, 0.055);
        }
        .landing-footer {
          background:
            radial-gradient(circle at 82% 0%, ${theme.accent}14 0, transparent 28%),
            linear-gradient(180deg, #f4f0e9 0%, #ffffff 70%);
        }
      `}</style>
      <header className="border-b-4 bg-[#f7f8f4]" style={{ borderBottomColor: theme.accent }}>
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-5 lg:px-10">
          <Link to="/landing" className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 items-center gap-2" aria-label="PDM and Municipality of Marilao">
              <img
                src={pdmLogo}
                alt="PDM seal"
                className="h-12 w-12 object-contain sm:h-14 sm:w-14 md:h-16 md:w-16"
              />
              <span className="h-9 w-px bg-stone-300 md:h-11" aria-hidden="true" />
              <img
                src={marilaoLogo}
                alt="Municipality of Marilao seal"
                className="h-11 w-11 object-contain sm:h-12 sm:w-12 md:h-14 md:w-14"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black uppercase leading-tight tracking-tight md:text-xl" style={{ color: theme.dark }}>
                Pambayang Dalubhasaan ng Marilao
              </span>
              <span className="mt-0.5 block text-xs font-semibold italic text-stone-600 md:text-sm">
                Abangan Norte, Marilao, Bulacan
              </span>
            </span>
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: theme.danger }}>
              SMaRT-PDM
            </p>
            <p className="mt-1 text-xs text-stone-500">OSFA Scholarship Monitoring System</p>
          </div>
        </div>
      </header>

      <nav
        aria-label="Landing page navigation"
        className="sticky top-0 z-50 border-b shadow-md"
        style={{ background: theme.dark, borderBottomColor: theme.accent, '--nav-accent': theme.accent }}
      >
        <div className="flex w-full items-center overflow-x-auto px-5 md:px-8 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigationItems.map(([label, href]) => (
            <a
              key={href}
              href={href}
              aria-current={activeSection === href.slice(1) ? 'location' : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] transition duration-300 hover:border-[var(--nav-accent)] hover:text-white md:px-4 ${
                activeSection === href.slice(1)
                  ? 'border-[var(--nav-accent)] bg-white/8 text-white'
                  : 'border-transparent text-white/80'
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section
        id="home"
        className="landing-hero relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.base} 58%, ${theme.heroEnd} 100%)`,
          borderBottom: `4px solid ${theme.accent}`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={pdmFacade}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.18] mix-blend-screen"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, ${theme.dark}e8 0%, ${theme.base}78 36%, rgba(0,0,0,0.04) 68%, rgba(255,255,255,0.04) 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%)',
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-[84rem] items-center gap-10 px-5 pb-16 pt-12 md:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pb-20 lg:pt-16">
          <div className="landing-hero-copy max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              <span className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
              {generalSettings.landing_content.hero_badge}
            </div>

            <h1 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-white md:text-4xl">
              {generalSettings.landing_content.hero_title}
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
              {generalSettings.landing_content.hero_description}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button href={APP_DOWNLOAD_URL} icon={Download} theme={theme}>
                Download APK
              </Button>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-lg font-bold text-white">4</p>
                <p className="mt-1 text-xs text-white/60">Staff portals</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-lg font-bold text-white">Mobile</p>
                <p className="mt-1 text-xs text-white/60">Scholar access</p>
              </div>

              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/8 p-4 sm:col-span-1">
                <p className="text-lg font-bold text-white">Secure</p>
                <p className="mt-1 text-xs text-white/60">Role-based login</p>
              </div>
            </div>
          </div>

          <div id="portals" className="landing-hero-panel scroll-mt-16 rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#92500f]">
                    Quick Access
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-stone-900">
                    Portal Directory
                  </h2>
                </div>

                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: theme.soft, color: theme.base }}
                >
                  <UsersRound size={19} />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {portalLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="group flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 transition hover:brightness-[0.98]"
                    style={{ borderColor: theme.border, background: theme.soft }}
                  >
                    <div>
                      <p className="text-sm font-bold text-stone-900">
                        {item.label} Portal
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Sign in to continue
                      </p>
                    </div>

                    <ArrowRight
                      size={17}
                      className="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-[#7c4a2e]"
                      style={{ color: theme.base }}
                    />
                  </Link>
                ))}
              </div>

              <div
                className="mt-5 rounded-2xl border p-4"
                style={{ background: theme.soft, borderColor: theme.border }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: '#fff', color: theme.base }}
                  >
                    <Smartphone size={18} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-stone-900">
                      {generalSettings.landing_content.mobile_app_title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-stone-600">
                      {generalSettings.landing_content.mobile_app_description}
                    </p>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
      {generalSettings.featured_notice ? (
        <section className="landing-zone-notice mx-auto w-full max-w-[84rem] px-5 pb-8 pt-8 md:px-8">
          <div
            className="relative overflow-hidden rounded-[1.75rem] border px-5 py-5 shadow-sm md:px-7"
            style={{ background: theme.soft, borderColor: theme.border }}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-40 blur-2xl"
              style={{ background: theme.accent }}
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: theme.base }}
                >
                  <Megaphone size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: theme.danger }}>
                    Featured OSFA Notice
                  </p>
                  <h2 className="mt-1.5 text-lg font-bold text-stone-900 md:text-xl">
                    {generalSettings.featured_notice.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                    {generalSettings.featured_notice.message}
                  </p>
                </div>
              </div>

              {generalSettings.featured_notice.link_label &&
              isSafePublicLink(generalSettings.featured_notice.link_url) ? (
                <Button
                  href={generalSettings.featured_notice.link_url}
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  theme={theme}
                >
                  {generalSettings.featured_notice.link_label}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section id="features" className="landing-zone-discover mx-auto w-full max-w-[84rem] scroll-mt-16 px-5 py-12 md:px-8">
        <div className="mb-7 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Platform Features
            </p>
            <h2 className="mt-2 text-2xl font-bold text-stone-900">
              {generalSettings.landing_content.features_title}
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-stone-500">
            {generalSettings.landing_content.features_description}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {generalSettings.landing_content.feature_items.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} icon={featureIcons[index]} theme={theme} />
          ))}
        </div>
      </section>

      {benefactors.length ? (
        <section id="benefactors" className="landing-zone-discover mx-auto w-full max-w-[84rem] scroll-mt-16 px-5 pb-12 md:px-8">
          <div
            className="rounded-[2rem] border px-6 py-7 md:px-8 md:py-8"
            style={{ background: '#ffffff', borderColor: theme.border }}
          >
            <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                  Benefactors
                </p>
                <h2 className="mt-2 text-2xl font-bold text-stone-900">
                  Scholarship benefactors and funding support
                </h2>
              </div>

              <p className="max-w-md text-sm leading-6 text-stone-500">
                These benefactors and funding sources help make scholarship access possible for PDM students.
              </p>
            </div>

            <style>{`
              @keyframes benefactor-carousel-scroll {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
              }
              .benefactor-carousel-track {
                animation: benefactor-carousel-scroll ${Math.max(18, benefactors.length * 6)}s linear infinite;
              }
              .benefactor-carousel:hover .benefactor-carousel-track,
              .benefactor-carousel:focus-within .benefactor-carousel-track {
                animation-play-state: paused;
              }
              @media (prefers-reduced-motion: reduce) {
                .benefactor-carousel-track { animation: none; transform: none; }
              }
            `}</style>

            <div
              className="benefactor-carousel overflow-hidden rounded-[1.5rem]"
              aria-roledescription="carousel"
              aria-label="Scholarship benefactors"
            >
              <div className="benefactor-carousel-track flex w-max">
                {[0, 1].map((copyIndex) => (
                  <div
                    key={`benefactor-set-${copyIndex}`}
                    className="flex shrink-0 gap-4 pr-4"
                    aria-hidden={copyIndex === 1 ? 'true' : undefined}
                  >
                    {benefactors.map((benefactor) => (
                      <div
                        key={`${copyIndex}-${benefactor.benefactor_id}`}
                        className="w-[280px] shrink-0 sm:w-[320px] lg:w-[350px]"
                      >
                        <BenefactorCard benefactor={benefactor} theme={theme} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      ) : null}

      <section id="guide" className="landing-zone-process mx-auto w-full max-w-[84rem] scroll-mt-16 px-5 pb-14 pt-12 md:px-8">
        <div
          className="rounded-[2rem] border px-6 py-7 md:px-8 md:py-8"
          style={{ background: '#fffdfb', borderColor: theme.border }}
        >
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                Applicant Quick Guide
              </p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">
                {generalSettings.landing_content.guide_title}
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-stone-500">
              {generalSettings.landing_content.guide_description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {generalSettings.landing_content.guide_steps.map((item, index) => (
              <StepCard key={`${index}-${item.title}`} {...item} step={String(index + 1).padStart(2, '0')} theme={theme} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-zone-process mx-auto w-full max-w-[84rem] px-5 pb-14 md:px-8" aria-label="PDM campus">
        <div className="group relative min-h-[240px] overflow-hidden rounded-[2rem] md:min-h-[300px]">
          <img
            src={pdmFacade}
            alt="Pambayang Dalubhasaan ng Marilao campus facade"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.02]"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, ${theme.dark}e6 0%, ${theme.base}9e 48%, rgba(0,0,0,0.12) 100%)`,
            }}
          />
          <div className="relative flex min-h-[240px] max-w-xl flex-col justify-end p-7 text-white md:min-h-[300px] md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Pambayang Dalubhasaan ng Marilao
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">
              {generalSettings.landing_content.campus_title}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/80">
              {generalSettings.landing_content.campus_description}
            </p>
          </div>
        </div>
      </section>

      <section className="landing-zone-bridge mx-auto w-full max-w-[84rem] px-5 pb-14 pt-14 md:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div
            className="landing-highlight-card relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-6 shadow-md md:p-7"
            style={{ borderColor: `${theme.accent}8f` }}
          >
            <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: theme.accent }} aria-hidden="true" />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: theme.soft, color: theme.base }}>
                <FileCheck2 size={20} aria-hidden="true" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                Eligibility Overview
              </p>
            </div>
            <h2 className="mt-2 text-xl font-bold text-stone-900">
              Check whether a scholarship may be right for you.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              {generalSettings.eligibility_summary}
            </p>
            <button
              type="button"
              onClick={() => setShowRequirements(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md"
              style={{ background: theme.accent, color: theme.dark }}
            >
              View application requirements
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div
            className="rounded-[1.75rem] border p-6 text-white shadow-sm"
            style={{ background: theme.dark, borderColor: theme.border }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
              Official PDM–OSFA Platform
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {generalSettings.landing_content.credibility_title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              {generalSettings.landing_content.credibility_description}
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="landing-zone-support mx-auto w-full max-w-[84rem] scroll-mt-16 px-5 pb-12 pt-12 md:px-8">
        <div
          className="grid gap-6 rounded-[2rem] border px-6 py-7 md:px-8 md:py-8 lg:grid-cols-[1.05fr_0.95fr]"
          style={{ background: '#ffffff', borderColor: theme.border }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              About OSFA
            </p>
            <h2 className="mt-2 text-2xl font-bold text-stone-900">
              Supporting scholarship access with a clearer process
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              {generalSettings.about_osfa}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: theme.soft, color: theme.base }}
              >
                <ShieldCheck size={19} />
              </div>
              <p className="mt-4 text-sm font-bold text-stone-900">Guided office review</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                SDO, Guidance, and Program Director reviews are tracked by stage for better accountability.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: theme.soft, color: theme.base }}
              >
                <FileCheck2 size={19} />
              </div>
              <p className="mt-4 text-sm font-bold text-stone-900">Readiness-based activation</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Scholar activation happens only after both requirements and endorsement are fully completed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {generalSettings.landing_faqs.length ? (
      <section id="faq" className="landing-zone-support mx-auto w-full max-w-[84rem] scroll-mt-6 px-5 pb-12 md:px-8">
        <div
          className="rounded-[2rem] border px-6 py-7 md:px-8 md:py-8"
          style={{ background: '#fffdfb', borderColor: theme.border }}
        >
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                Frequently Asked Questions
              </p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">
                Quick answers for applicants and families
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-stone-500">
              A short public guide to make the scholarship process easier to understand before applying.
            </p>
          </div>

          <div className="grid gap-4">
            {generalSettings.landing_faqs.map((item, index) => (
              <FaqCard
                key={item.question}
                item={item}
                theme={theme}
                isOpen={activeFaq === index}
                panelId={`faq-panel-${index}`}
                onToggle={() => setActiveFaq((current) => (current === index ? -1 : index))}
              />
            ))}
          </div>
        </div>
      </section>
      ) : null}

      </main>

      <footer
        id="contact"
        className="landing-footer scroll-mt-16 overflow-hidden border-t-4 px-5 pt-7 text-white md:px-8 lg:px-10"
        style={{
          borderTopColor: theme.accent,
          background: `linear-gradient(135deg, ${theme.dark} 0%, #24140d 100%)`,
        }}
      >
        <div className="mx-auto w-full max-w-[96rem]">
          <div className="grid gap-8 border-b border-white/15 pb-7 lg:grid-cols-[1.15fr_1.25fr_0.8fr]">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex shrink-0 items-center gap-2.5" aria-label="PDM and Municipality of Marilao">
                  <img src={pdmLogo} alt="PDM seal" className="h-14 w-14 object-contain" />
                  <span className="h-9 w-px bg-white/25" aria-hidden="true" />
                  <img
                    src={marilaoLogo}
                    alt="Municipality of Marilao seal"
                    className="h-11 w-11 rounded-full bg-white object-contain"
                  />
                </div>
                <div className="min-w-0 border-l border-white/15 pl-4">
                  <p className="text-base font-bold text-white">SMaRT-PDM</p>
                  <p className="mt-1 text-xs leading-5 text-white/70">{generalSettings.office_name}</p>
                </div>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/60">
                Official scholarship monitoring platform of Pambayang Dalubhasaan ng Marilao.
              </p>
              <a
                href={APP_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download the SMaRT-PDM app"
                className="mt-4 inline-flex min-w-[174px] items-center gap-2.5 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-md focus:outline-none focus:ring-4 focus:ring-white/15"
              >
                <Smartphone className="h-7 w-7 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className="text-left">
                  <span className="block text-[10px] font-medium uppercase leading-none tracking-wide text-white/80">
                    Download the
                  </span>
                  <span className="mt-1 block text-base font-semibold leading-none">
                    SMaRT-PDM App
                  </span>
                </span>
              </a>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
                Office Contact
              </p>
              <div className="mt-4 grid gap-x-7 gap-y-4 text-sm text-white/75 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                  <span>{generalSettings.office_address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                  <span>{generalSettings.landline_number}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                  <span>{generalSettings.office_hours}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                  <span className="break-all">{generalSettings.office_email}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
                Public Links
              </p>
              <div className="mt-4 flex flex-col items-start gap-3 text-sm">
                <button type="button" onClick={() => setActivePolicy('privacy')} className="text-white/70 transition hover:text-white">
                  Privacy Notice
                </button>
                <button type="button" onClick={() => setActivePolicy('terms')} className="text-white/70 transition hover:text-white">
                  Terms of Use
                </button>
                <button type="button" onClick={() => setActivePolicy('consent')} className="text-left text-white/70 transition hover:text-white">
                  Data Processing Consent
                </button>
                <a
                  href={PDM_FACEBOOK_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-bold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md focus:outline-none focus:ring-4"
                  style={{
                    background: theme.accent,
                    borderColor: `${theme.accent}`,
                    color: theme.dark,
                    '--tw-ring-color': `${theme.accent}40`,
                  }}
                >
                  <Globe2 className="h-4 w-4" />
                  Visit PDM Facebook
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 py-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <p className="text-xs font-semibold text-white">
              SMaRT-PDM · Office for Scholarship and Financial Assistance
            </p>

            <p className="text-xs text-white/65">
              © {new Date().getFullYear()} Pambayang Dalubhasaan ng Marilao
            </p>
          </div>
        </div>
      </footer>

      {activePolicy ? (
        <PolicyModal
          type={activePolicy}
          content={policyContent}
          theme={theme}
          onClose={() => setActivePolicy(null)}
        />
      ) : null}

      {showRequirements ? (
        <RequirementsModal
          content={generalSettings.landing_content}
          theme={theme}
          onClose={() => setShowRequirements(false)}
        />
      ) : null}

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:brightness-95 focus:outline-none focus:ring-4 md:bottom-7 md:right-7 ${
          showBackToTop
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}
        style={{ background: theme.base, '--tw-ring-color': `${theme.base}33` }}
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp size={19} strokeWidth={2.4} />
      </button>
    </div>
  );
}
