'use client';

import type { IconType } from 'react-icons';
import PremiumKpiCard from './PremiumKpiCard';

type Accent = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'indigo' | 'gold' | 'slate';

export type PremiumStatItem = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: IconType;
  accent?: Accent;
  trend?: string;
};

type PremiumStatGridProps = {
  items: PremiumStatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
};

const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
} as const;

export default function PremiumStatGrid({ items, columns = 4, className = '' }: PremiumStatGridProps) {
  return (
    <div className={`grid gap-3 ${COLS[columns]} ${className}`}>
      {items.map((item) => (
        <PremiumKpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          subtitle={item.subtitle}
          icon={item.icon}
          accent={item.accent ?? 'indigo'}
          trend={item.trend}
        />
      ))}
    </div>
  );
}
