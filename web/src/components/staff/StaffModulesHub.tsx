'use client';

import PortalModulesHub from '@/components/dashboard/PortalModulesHub';
import {
  getStaffTabsFromModules,
  STAFF_MODULE_CATEGORIES,
  type StaffModuleId,
} from '@/lib/staffModules';

type StaffModulesHubProps = {
  visibleModules: StaffModuleId[];
  onNavigate: (tabId: StaffModuleId) => void;
};

export default function StaffModulesHub({ visibleModules, onNavigate }: StaffModulesHubProps) {
  const tabs = getStaffTabsFromModules(visibleModules);

  return (
    <PortalModulesHub
      allTabs={tabs}
      categories={STAFF_MODULE_CATEGORIES}
      onNavigate={(id) => onNavigate(id as StaffModuleId)}
      title="Tous vos modules"
      subtitle="Accès direct à l’ensemble des fonctions activées pour votre poste, classées par domaine."
      excludeIds={['overview']}
    />
  );
}
