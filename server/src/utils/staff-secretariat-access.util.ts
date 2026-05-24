import type { StaffModuleId } from './staff-visible-modules.util';
import {
  isStaffModuleAdminPath,
  staffModuleAdminPathAllowed,
} from './staff-module-admin-access.util';

/** @deprecated Utiliser staff-module-admin-access.util */
export function isStaffSecretariatAdminPath(path: string, method: string): boolean {
  return isStaffModuleAdminPath(path, method);
}

/** @deprecated */
export function staffSecretariatPathAllowed(
  visibleModules: StaffModuleId[],
  path: string,
  method: string,
): boolean {
  return staffModuleAdminPathAllowed(visibleModules, path, method);
}

/** @deprecated */
export function staffSecretariatAccessGranted(
  visibleModules: StaffModuleId[],
  path: string,
  method: string,
): boolean {
  if (!isStaffModuleAdminPath(path, method)) return false;
  return staffModuleAdminPathAllowed(visibleModules, path, method);
}
