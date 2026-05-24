'use client';

import type { ReactNode } from 'react';
import PremiumDashboardShell from './PremiumDashboardShell';

type PremiumPortalShellProps = {
  children: ReactNode;
  variant?: 'admin' | 'super' | 'teacher' | 'student' | 'parent' | 'educator' | 'staff' | 'director';
  className?: string;
};

const VARIANT_MAP: Record<NonNullable<PremiumPortalShellProps['variant']>, 'admin' | 'super'> = {
  admin: 'admin',
  super: 'super',
  teacher: 'admin',
  student: 'admin',
  parent: 'admin',
  educator: 'admin',
  staff: 'admin',
  director: 'admin',
};

/** Enveloppe premium pour tous les espaces métier (portails rôle + admin). */
export default function PremiumPortalShell({
  children,
  variant = 'admin',
  className = '',
}: PremiumPortalShellProps) {
  return (
    <PremiumDashboardShell variant={VARIANT_MAP[variant]}>
      <div className={`min-h-[calc(100vh-4rem)] ${className}`}>{children}</div>
    </PremiumDashboardShell>
  );
}
