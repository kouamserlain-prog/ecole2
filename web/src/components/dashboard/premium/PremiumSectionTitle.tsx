'use client';

import type { IconType } from 'react-icons';

type PremiumSectionTitleProps = {
  title: string;
  subtitle?: string;
  icon?: IconType;
  action?: React.ReactNode;
};

export default function PremiumSectionTitle({
  title,
  subtitle,
  icon: Icon,
  action,
}: PremiumSectionTitleProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-amber-400 shadow-md ring-1 ring-white/10">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        )}
        <div>
          <h3 className="font-display text-sm font-bold tracking-tight text-stone-900 sm:text-base">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs font-medium text-stone-500">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
