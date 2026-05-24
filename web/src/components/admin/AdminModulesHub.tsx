'use client';

import PortalModulesHub, { type PortalModuleTab } from '../dashboard/PortalModulesHub';
import { ADMIN_MODULE_CATEGORIES } from '@/lib/adminModules';

export type AdminModulesHubTab = PortalModuleTab;

type AdminModulesHubProps = {
  allTabs: AdminModulesHubTab[];
  onNavigate: (tabId: string) => void;
};

const AdminModulesHub: React.FC<AdminModulesHubProps> = ({ allTabs, onNavigate }) => (
  <PortalModulesHub
    allTabs={allTabs}
    categories={ADMIN_MODULE_CATEGORIES}
    onNavigate={onNavigate}
    title="Annuaire des modules"
    subtitle="Accès rapide à toutes les fonctions d’administration, groupées par domaine. Filtrez par nom ou mot-clé."
    excludeIds={['dashboard']}
  />
);

export default AdminModulesHub;
