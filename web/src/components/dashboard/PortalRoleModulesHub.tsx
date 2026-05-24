'use client';

import PortalModulesHub, {
  type PortalModuleCategory,
  type PortalModuleTab,
} from '@/components/dashboard/PortalModulesHub';

type PortalRoleModulesHubProps = {
  tabs: PortalModuleTab[];
  categories: PortalModuleCategory[];
  onNavigate: (tabId: string) => void;
  title?: string;
  subtitle?: string;
};

/** Annuaire de modules pour les espaces élève, enseignant, parent et éducateur. */
export default function PortalRoleModulesHub({
  tabs,
  categories,
  onNavigate,
  title = 'Tous les modules',
  subtitle = 'Accès direct à l’ensemble des fonctions de votre espace, classées par domaine.',
}: PortalRoleModulesHubProps) {
  return (
    <PortalModulesHub
      allTabs={tabs}
      categories={categories}
      onNavigate={onNavigate}
      title={title}
      subtitle={subtitle}
      excludeIds={['overview']}
    />
  );
}
