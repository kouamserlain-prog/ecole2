'use client';

import type { ReactNode } from 'react';

type PremiumOverviewHeroProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  gradient?: string;
};

export default function PremiumOverviewHero({
  eyebrow,
  title,
  description,
  gradient = 'from-indigo-600 via-violet-600 to-fuchsia-700',
}: PremiumOverviewHeroProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-px shadow-[0_16px_48px_-20px_rgba(15,23,42,0.35)] ring-1 ring-white/15`}>
      <div className="relative overflow-hidden rounded-[15px] bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(99,102,241,0.08),transparent_55%)]" />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600/90">{eyebrow}</p>
        <p className="relative font-display text-lg font-bold tracking-tight text-stone-900 sm:text-xl">{title}</p>
        {description && (
          <p className="relative mt-2 max-w-3xl text-sm font-medium leading-relaxed text-stone-600">{description}</p>
        )}
      </div>
    </div>
  );
}
