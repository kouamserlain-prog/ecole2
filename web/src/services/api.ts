/**
 * Point d'entrée API — réexporte les modules modulaires et le client Axios partagé
 * (Bearer + X-School-Id + cache hors ligne).
 */
export { default, default as api, getApiHealthUrl } from './api/client';
export { authApi } from './api/auth';
export { publicApi } from './api/public';
export { adminApi } from './api/admin.api';
export { adminParentGuardiansApi } from './api/admin-parent-guardians.api';
export { adminTuitionCatalogApi } from './api/admin-tuition-catalog.api';
export { adminAccountingApi } from './api/admin-accounting.api';
export { teacherApi } from './api/teacher.api';
export { studentApi } from './api/student.api';
export { parentApi } from './api/parent.api';
export { parentFamilyPortalApi } from './api/parent-family-portal.api';
export { educatorApi } from './api/educator.api';
export { staffApi } from './api/staff.api';
export { healthApi } from './api/health.api';
export { superAdminApi } from './api/superAdmin.api';
export { academicValidationApi } from './api/academicValidation.api';
export { elearningApi, uploadElearningFile } from './api/elearning.api';
export { faceApi } from './api/face.api';
export { digitalLibraryApi } from './api/digitalLibrary.api';
export {
  adminLibraryManagementApi,
  staffLibraryManagementApi,
} from './api/libraryManagement.api';
export {
  uploadIdentityDocument,
  uploadTeacherAdministrativeDocument,
  uploadAssignmentAttachment,
} from './api/upload';
