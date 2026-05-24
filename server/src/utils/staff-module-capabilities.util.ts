import type { StaffModuleId } from './staff-visible-modules.util';

/**
 * Modules affichés en consultation seule (registre, rapports, pilotage…).
 * Tous les autres modules visibles accordent création / modification / suppression
 * sur les routes /admin couvertes par le module.
 */
export const STAFF_MODULES_READ_ONLY: ReadonlySet<StaffModuleId> = new Set([
  'overview',
  'student_registry',
  'reports_mgmt',
  'analytics_mgmt',
  'pedagogical_tracking',
  'academic_overview',
]);

export function staffModuleIsReadOnlyByDesign(moduleId: StaffModuleId): boolean {
  return STAFF_MODULES_READ_ONLY.has(moduleId);
}

/** Le métier peut agir (pas seulement consulter) dans ce module. */
export function staffModuleGrantsWriteAccess(
  moduleId: StaffModuleId,
  visibleModules: StaffModuleId[],
): boolean {
  return visibleModules.includes(moduleId) && !staffModuleIsReadOnlyByDesign(moduleId);
}
