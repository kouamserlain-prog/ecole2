'use client';

import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FiCommand } from 'react-icons/fi';

export type PremiumModuleHeaderProps = {
  title: string;
  description?: string;
  icon: IconType;
  gradient: string;
  badge?: string;
  badgeIcon?: IconType;
  actions?: ReactNode;
};

export default function PremiumModuleHeader({
  title,
  description,
  icon: Icon,
  gradient,
  badge,
  badgeIcon: BadgeIcon = FiCommand,
  actions,
}: PremiumModuleHeaderProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-px shadow-[0_20px_48px_-20px_rgba(15,23,42,0.35)] ring-1 ring-white/20`}
    >
      <div className="relative overflow-hidden rounded-[15px] bg-white/95 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_100%_0%,rgba(255,255,255,0.55),transparent_55%)]" />
        <div className="relative flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ring-1 ring-white/30`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-tight text-stone-900 sm:text-lg">
                {title}
              </h2>
              {description && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-600 sm:text-sm">
                  {description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200/80">
                <BadgeIcon className="h-3.5 w-3.5 text-amber-700/90" aria-hidden />
                {badge}
              </span>
            )}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
