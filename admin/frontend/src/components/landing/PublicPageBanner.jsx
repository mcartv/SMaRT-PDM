import React from 'react';
import pdmFacade from '@/assets/PDM-Facade-optimized.jpg';

export default function PublicPageBanner({ title, description, theme }) {
  return <header id="overview" className="scroll-mt-28 overflow-hidden rounded-3xl border bg-white shadow-[0_18px_48px_-36px_rgba(55,32,18,0.45)]" style={{borderColor:theme.border}}>
    <div className="relative flex min-h-[12.5rem] items-center justify-center overflow-hidden px-6 py-9 text-center md:min-h-[14rem] md:px-12 md:py-11">
      <img src={pdmFacade} alt="Pambayang Dalubhasaan ng Marilao facade" className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.11] grayscale"/>
      <div className="absolute inset-0 bg-gradient-to-b from-white/94 via-white/86 to-[#fffdf8]/96"/>
      <div className="relative max-w-4xl">
        <h1 className="text-3xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-4xl md:text-[2.75rem]" style={{color:theme.dark}}>{title}</h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-stone-600 md:text-[15px] md:leading-7">{description}</p>
        <span className="mx-auto mt-5 block h-1 w-16 rounded-full" style={{background:theme.accent}}/>
      </div>
    </div>
  </header>;
}
