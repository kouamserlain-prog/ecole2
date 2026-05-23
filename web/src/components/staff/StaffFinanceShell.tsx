'use client';

import type { ReactNode } from 'react';

/** Enveloppe pour les écrans financiers admin réutilisés dans l’espace économe. */
export default function StaffFinanceShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-xs text-emerald-950 leading-relaxed">
        Espace <strong>économat</strong> — vous pouvez consulter et enregistrer les opérations financières
        autorisées (frais, paiements, comptabilité, guichet).
      </p>
      {children}
    </div>
  );
}
