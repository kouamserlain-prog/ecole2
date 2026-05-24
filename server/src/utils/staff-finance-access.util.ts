import type { StaffModuleId } from './staff-visible-modules.util';
import {
  isStaffModuleAdminPath,
  staffModuleAdminPathAllowed,
} from './staff-module-admin-access.util';

/** @deprecated Utiliser staff-module-admin-access.util — conservé pour compatibilité scripts. */
export const BURSAR_STAFF_MODULES: StaffModuleId[] = [
  'overview',
  'counter',
  'admissions',
  'treasury',
  'notifications_mgmt',
  'reports_mgmt',
  'extracurricular_mgmt',
  'attendance_mgmt',
  'parents_mgmt',
  'hr_mgmt',
  'fees_mgmt',
  'tuition_fees_mgmt',
  'payments_mgmt',
  'accounting_mgmt',
  'administrative_mgmt',
  'communication_mgmt',
  'material_mgmt',
];

/** @deprecated */
export function isStaffFinanceAdminPath(path: string, method: string): boolean {
  return isStaffModuleAdminPath(path, method);
}

/** @deprecated */
export function staffFinancePathAllowed(
  visibleModules: StaffModuleId[],
  path: string,
  method: string,
): boolean {
  return staffModuleAdminPathAllowed(visibleModules, path, method);
}
