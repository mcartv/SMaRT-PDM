import React from 'react';
import { Building2 } from 'lucide-react';

function initialsFromName(name) {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'SP';
}

export default function BenefactorLogo({
  src,
  name,
  className = 'h-10 w-10',
  imageClassName = 'h-full w-full object-contain',
  showBuildingFallback = false,
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 shadow-sm ${className}`}
      title={name || 'Scholarship benefactor'}
    >
      {src ? (
        <img
          src={src}
          alt={`${name || 'Benefactor'} logo`}
          loading="lazy"
          decoding="async"
          className={imageClassName}
        />
      ) : showBuildingFallback ? (
        <Building2 className="h-4 w-4 text-[var(--portal-base)]" aria-hidden="true" />
      ) : (
        <span
          className="text-xs font-bold tracking-tight text-[var(--portal-base)]"
          aria-label={`${name || 'Scholarship'} initials`}
        >
          {initialsFromName(name)}
        </span>
      )}
    </div>
  );
}

export { initialsFromName };
