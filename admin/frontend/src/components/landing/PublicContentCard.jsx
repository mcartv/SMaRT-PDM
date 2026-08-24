import React from 'react';

export default function PublicContentCard({
  theme,
  children,
  className = '',
  tone = 'white',
}) {
  const background = tone === 'soft' ? theme.soft : '#ffffff';

  return (
    <section
      className={`overflow-hidden rounded-2xl border shadow-[0_14px_36px_-30px_rgba(55,32,18,0.55)] ${className}`}
      style={{ background, borderColor: theme.border }}
    >
      {children}
    </section>
  );
}

export function PublicCardHeading({
  theme,
  icon: Icon,
  eyebrow,
  title,
  description,
  className = '',
  iconBackground = 'soft',
}) {
  return (
    <header className={`flex items-start gap-4 ${className}`}>
      {Icon && (
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBackground === 'white' ? '#ffffff' : theme.soft, color: theme.base }}
        >
          <Icon size={20} strokeWidth={1.9} />
        </span>
      )}
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: theme.base }}
          >
            {eyebrow}
          </p>
        )}
        <h2 className={`${eyebrow ? 'mt-2' : ''} text-xl font-bold leading-7 md:text-2xl md:leading-8`}>
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500 md:text-[15px] md:leading-7">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
