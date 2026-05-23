import axios, { AxiosHeaders } from 'axios';
import type { AppBrandingUploadSlot } from '@/lib/appBrandingUpload';

/**
 * Base URL sans slash final, toujours avec préfixe `/api` pour l’API Express locale.
 * - Si `NEXT_PUBLIC_API_URL` vaut `http://localhost:5000` (sans `/api`), on complète.
 */
function ensureApiBaseUrl(raw: string | undefined): string {
  const n = raw?.replace(/\/+$/, '').trim();
  if (!n) return 'http://localhost:5000/api';
  if (n.startsWith('http')) {
    try {
      const u = new URL(n);
      const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
      if (path === '/') {
        return `${n.replace(/\/+$/, '')}/api`;
      }
    } catch {
      /* ignore */
    }
    return n;
  }
  return n;
}

/**
 * Base URL sans slash final.
 * - Navigateur sur Vercel : même origine `/api` (ou NEXT_PUBLIC_API_URL).
 * - SSR / Node : URL absolue (VERCEL_URL + préfixe, ou localhost:5000 en dev).
 */
const API_URL = (() => {
  const n = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (n?.startsWith('http')) return ensureApiBaseUrl(n);
  if (typeof window !== 'undefined') {
    return n || (process.env.VERCEL ? '/api' : 'http://localhost:5000/api');
  }
  if (process.env.VERCEL_URL) {
    const path = n?.startsWith('/') ? n : '/api';
    return `https://${process.env.VERCEL_URL}${path}`;
  }
  if (n?.startsWith('/')) {
    return `http://localhost:5000${n}`;
  }
  return n || 'http://localhost:5000/api';
})();

/** Santé backend : `GET {base}/health` (base URL inclut déjà `/api`). */
export function getApiHealthUrl(): string {
  return `${API_URL.replace(/\/+$/, '')}/health`;
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

function isPublicAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return PUBLIC_AUTH_PATHS.some((p) => normalized === p);
}

// Intercepteur : ne pas envoyer de Bearer sur login / register / reset (évite conflit avec un vieux token)
// + multipart (FormData) : retirer Content-Type application/json pour que le boundary multipart soit défini
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers;
    if (h instanceof AxiosHeaders) {
      h.delete('Content-Type');
    } else if (h && typeof h === 'object') {
      delete (h as Record<string, unknown>)['Content-Type'];
      delete (h as Record<string, unknown>)['content-type'];
    }
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token && !isPublicAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ne pas rediriger automatiquement si c'est une erreur de connexion
    // (serveur non démarré)
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.warn('Serveur backend non disponible. Assurez-vous que le serveur est démarré.');
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
      } catch {
        /* ignore */
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string, twoFactorCode?: string) => {
    try {
      const emailNorm = String(email).trim().toLowerCase();
      const response = await api.post('/auth/login', {
        email: emailNorm,
        password,
        ...(twoFactorCode ? { twoFactorCode } : {}),
      });
      if (response.data && response.data.token && response.data.user) {
        return response.data;
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (error: any) {
      console.error('Erreur API login:', error);
      if (error.response) {
        throw error;
      } else {
        throw new Error('Impossible de se connecter au serveur. Vérifiez que le serveur est démarré.');
      }
    }
  },
  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  updateMe: async (data: any) => {
    const response = await api.put('/auth/me', data);
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },
  setupTwoFactor: async () => {
    const response = await api.post('/auth/2fa/setup');
    return response.data as { otpauthUrl: string; qrCodeDataUrl: string };
  },
  verifyTwoFactor: async (code: string) => {
    const response = await api.post('/auth/2fa/verify', { code });
    return response.data as { ok: boolean; enabled: boolean };
  },
  disableTwoFactor: async (password: string) => {
    const response = await api.post('/auth/2fa/disable', { password });
    return response.data as { ok: boolean; enabled: boolean };
  },
  downloadGdprExport: async (): Promise<Blob> => {
    const response = await api.get('/auth/gdpr/export', { responseType: 'blob' });
    return response.data as Blob;
  },
  requestGdprErasure: async (details?: string) => {
    const response = await api.post('/auth/gdpr/erasure-request', { details });
    return response.data as { message: string };
  },
};

/** Formulaire public de pré-inscription et suivi de dossier (sans compte) */
export const publicApi = {
  submitAdmission: async (data: FormData | Record<string, unknown>, schoolSlug?: string) => {
    const response = await api.post('/public/admissions', data, {
      params: schoolSlug?.trim() ? { school: schoolSlug.trim() } : undefined,
    });
    return response.data;
  },
  trackAdmission: async (reference: string) => {
    const response = await api.get(
      `/public/admissions/track/${encodeURIComponent(reference.trim())}`
    );
    return response.data;
  },
  getStudentCardByPublicId: async (publicId: string) => {
    const response = await api.get(
      `/public/student-card/${encodeURIComponent(publicId.trim())}`
    );
    return response.data;
  },
  getAppBranding: async (params?: { school?: string }) => {
    const response = await api.get('/public/app-branding', { params });
    return response.data;
  },
  listSchools: async () => {
    const response = await api.get('/public/schools');
    return response.data;
  },
};

export const adminApi = {
  getStudents: async () => {
    const response = await api.get('/admin/students');
    return response.data;
  },
  createStudent: async (data: any) => {
    const response = await api.post('/admin/students', data);
    return response.data;
  },
  getStudent: async (id: string) => {
    const response = await api.get(`/admin/students/${id}`);
    return response.data;
  },
  getStudentByNFC: async (nfcId: string) => {
    const response = await api.get(`/admin/students/nfc/${nfcId}`);
    return response.data;
  },
  getTeacherByNFC: async (nfcId: string) => {
    const response = await api.get(`/admin/teachers/nfc/${nfcId}`);
    return response.data;
  },
  recordTeacherNFCAttendance: async (data: {
    teacherId: string;
    date: string;
    status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  }) => {
    const response = await api.post('/admin/teachers/nfc-attendance', data);
    return response.data;
  },
  getTeacherAttendance: async (params?: { teacherId?: string; from?: string; to?: string }) => {
    const response = await api.get('/admin/teachers/attendance', { params });
    return response.data;
  },
  getAccessControlOverview: async () => {
    const response = await api.get('/admin/access-control/overview');
    return response.data;
  },
  getAccessControlEntryLogs: async (params?: { type?: string; limit?: number }) => {
    const response = await api.get('/admin/access-control/entry-logs', { params });
    return response.data;
  },
  createAccessControlEntryLog: async (data: {
    type: string;
    description: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    userId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const response = await api.post('/admin/access-control/entry-logs', data);
    return response.data;
  },
  getAccessControlAppointments: async (params?: { from?: string; to?: string; status?: string }) => {
    const response = await api.get('/admin/access-control/appointments', { params });
    return response.data;
  },
  getAccessControlCctv: async () => {
    const response = await api.get('/admin/access-control/cctv');
    return response.data;
  },
  getAccessControlAlarm: async () => {
    const response = await api.get('/admin/access-control/alarm');
    return response.data;
  },
  updateStudent: async (id: string, data: any) => {
    const response = await api.put(`/admin/students/${id}`, data);
    return response.data;
  },
  deleteStudent: async (id: string) => {
    const response = await api.delete(`/admin/students/${id}`);
    return response.data;
  },
  getClasses: async () => {
    const response = await api.get('/admin/classes');
    return response.data;
  },
  createClass: async (data: any) => {
    const response = await api.post('/admin/classes', data);
    return response.data;
  },
  updateClass: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/classes/${id}`, data);
    return response.data;
  },
  createClassGroup: async (classId: string, data: { name: string; sortOrder?: number }) => {
    const response = await api.post(`/admin/classes/${classId}/groups`, data);
    return response.data;
  },
  updateClassGroup: async (groupId: string, data: { name?: string; sortOrder?: number }) => {
    const response = await api.patch(`/admin/class-groups/${groupId}`, data);
    return response.data;
  },
  deleteClassGroup: async (groupId: string) => {
    const response = await api.delete(`/admin/class-groups/${groupId}`);
    return response.data;
  },
  getTeachers: async () => {
    const response = await api.get('/admin/teachers');
    return response.data;
  },
  createTeacher: async (data: any) => {
    const response = await api.post('/admin/teachers', data);
    return response.data;
  },
  getTeacher: async (id: string) => {
    const response = await api.get(`/admin/teachers/${id}`);
    return response.data;
  },
  updateTeacher: async (id: string, data: any) => {
    const response = await api.put(`/admin/teachers/${id}`, data);
    return response.data;
  },
  deleteTeacher: async (id: string) => {
    const response = await api.delete(`/admin/teachers/${id}`);
    return response.data;
  },
  getTeacherAdministrativeDocuments: async (teacherId: string) => {
    const response = await api.get(`/admin/teachers/${teacherId}/administrative-documents`);
    return response.data;
  },
  deleteTeacherAdministrativeDocument: async (teacherId: string, documentId: string) => {
    const response = await api.delete(
      `/admin/teachers/${teacherId}/administrative-documents/${documentId}`
    );
    return response.data;
  },
  addTeacherQualification: async (
    teacherId: string,
    data: {
      title: string;
      institution?: string;
      field?: string;
      obtainedAt?: string | null;
      notes?: string;
    }
  ) => {
    const response = await api.post(`/admin/teachers/${teacherId}/qualifications`, data);
    return response.data;
  },
  deleteTeacherQualification: async (teacherId: string, qualificationId: string) => {
    const response = await api.delete(`/admin/teachers/${teacherId}/qualifications/${qualificationId}`);
    return response.data;
  },
  addTeacherCareerHistory: async (
    teacherId: string,
    data: {
      institution: string;
      role: string;
      startDate: string;
      endDate?: string | null;
      country?: string;
      notes?: string;
    }
  ) => {
    const response = await api.post(`/admin/teachers/${teacherId}/career-history`, data);
    return response.data;
  },
  deleteTeacherCareerHistoryEntry: async (teacherId: string, entryId: string) => {
    const response = await api.delete(`/admin/teachers/${teacherId}/career-history/${entryId}`);
    return response.data;
  },
  addTeacherProfessionalTraining: async (
    teacherId: string,
    data: {
      title: string;
      organization?: string;
      hours?: number | null;
      completedAt?: string | null;
      notes?: string;
    }
  ) => {
    const response = await api.post(`/admin/teachers/${teacherId}/professional-trainings`, data);
    return response.data;
  },
  deleteTeacherProfessionalTraining: async (teacherId: string, trainingId: string) => {
    const response = await api.delete(
      `/admin/teachers/${teacherId}/professional-trainings/${trainingId}`
    );
    return response.data;
  },
  createTeacherPerformanceReview: async (
    teacherId: string,
    data: {
      periodLabel: string;
      academicYear: string;
      overallScore?: number | null;
      objectives?: string | null;
      achievements?: string | null;
      improvements?: string | null;
      reviewerName?: string | null;
    }
  ) => {
    const response = await api.post(`/admin/teachers/${teacherId}/performance-reviews`, data);
    return response.data;
  },
  updateTeacherLeaveStatus: async (
    teacherId: string,
    leaveId: string,
    data: { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; adminComment?: string | null }
  ) => {
    const response = await api.patch(`/admin/teachers/${teacherId}/leaves/${leaveId}`, data);
    return response.data;
  },
  getTeacherPerformanceReviews: async (teacherId: string) => {
    const response = await api.get(`/admin/teachers/${teacherId}/performance-reviews`);
    return response.data;
  },
  getTeacherLeaves: async (teacherId: string) => {
    const response = await api.get(`/admin/teachers/${teacherId}/leaves`);
    return response.data;
  },
  /** Vue RH : tous les congés enseignants */
  getHrTeacherLeaves: async (params?: { status?: string }) => {
    const response = await api.get('/admin/hr/teacher-leaves', { params });
    return response.data;
  },
  /** Vue RH : toutes les fiches d’évaluation */
  getHrTeacherPerformanceReviews: async () => {
    const response = await api.get('/admin/hr/teacher-performance-reviews');
    return response.data;
  },
  getDashboard: async () => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },
  getDashboardKpis: async () => {
    const response = await api.get('/admin/dashboard/kpis');
    return response.data;
  },
  getSystemMetrics: async () => {
    const response = await api.get('/admin/system/metrics');
    return response.data;
  },
  getAllGrades: async (params?: { studentId?: string; courseId?: string; classId?: string }) => {
    const response = await api.get('/admin/grades', { params });
    return response.data;
  },
  getAllAbsences: async (params?: { studentId?: string; courseId?: string; classId?: string; date?: string }) => {
    const response = await api.get('/admin/absences', { params });
    return response.data;
  },
  getAllAssignments: async (params?: { courseId?: string; classId?: string }) => {
    const response = await api.get('/admin/assignments', { params });
    return response.data;
  },
  getAllCourses: async (params?: { classId?: string }) => {
    const response = await api.get('/admin/courses', { params });
    return response.data;
  },
  getCourseById: async (courseId: string) => {
    const response = await api.get(`/admin/courses/${courseId}`);
    return response.data;
  },
  createCourse: async (data: {
    name: string;
    code: string;
    classId: string;
    teacherId: string;
    description?: string | null;
    weeklyHours?: number | null;
    gradingCoefficient?: number;
  }) => {
    const response = await api.post('/admin/courses', data);
    return response.data;
  },
  updateCourse: async (
    courseId: string,
    data: Partial<{
      name: string;
      code: string;
      classId: string;
      teacherId: string;
      description: string | null;
      weeklyHours: number | null;
      gradingCoefficient: number | null;
    }>
  ) => {
    const response = await api.put(`/admin/courses/${courseId}`, data);
    return response.data;
  },
  deleteCourse: async (courseId: string) => {
    const response = await api.delete(`/admin/courses/${courseId}`);
    return response.data;
  },
  getSchoolTracks: async (params?: { academicYear?: string }) => {
    const response = await api.get('/admin/school-tracks', { params });
    return response.data;
  },
  createSchoolTrack: async (data: {
    name: string;
    code: string;
    description?: string | null;
    academicYear?: string | null;
    levels?: string[];
    sortOrder?: number;
  }) => {
    const response = await api.post('/admin/school-tracks', data);
    return response.data;
  },
  updateSchoolTrack: async (
    id: string,
    data: Partial<{
      name: string;
      code: string;
      description: string | null;
      academicYear: string | null;
      levels: string[];
      sortOrder: number;
    }>
  ) => {
    const response = await api.patch(`/admin/school-tracks/${id}`, data);
    return response.data;
  },
  deleteSchoolTrack: async (id: string) => {
    const response = await api.delete(`/admin/school-tracks/${id}`);
    return response.data;
  },
  getSubjectOptions: async () => {
    const response = await api.get('/admin/subject-options');
    return response.data;
  },
  createSubjectOption: async (data: {
    name: string;
    code: string;
    description?: string | null;
    weeklyHours?: number | null;
    gradingCoefficient?: number | null;
  }) => {
    const response = await api.post('/admin/subject-options', data);
    return response.data;
  },
  updateSubjectOption: async (
    id: string,
    data: Partial<{
      name: string;
      code: string;
      description: string | null;
      weeklyHours: number | null;
      gradingCoefficient: number | null;
    }>
  ) => {
    const response = await api.patch(`/admin/subject-options/${id}`, data);
    return response.data;
  },
  deleteSubjectOption: async (id: string) => {
    const response = await api.delete(`/admin/subject-options/${id}`);
    return response.data;
  },
  getTrackAvailableOptions: async (trackId: string) => {
    const response = await api.get(`/admin/school-tracks/${trackId}/available-options`);
    return response.data;
  },
  addTrackAvailableOption: async (
    trackId: string,
    data: { optionId: string; sortOrder?: number; notes?: string | null }
  ) => {
    const response = await api.post(`/admin/school-tracks/${trackId}/available-options`, data);
    return response.data;
  },
  removeTrackAvailableOption: async (trackId: string, linkId: string) => {
    const response = await api.delete(
      `/admin/school-tracks/${trackId}/available-options/${linkId}`
    );
    return response.data;
  },
  getSchoolCurricula: async (params?: {
    level?: string;
    academicYear?: string;
    trackId?: string | null;
  }) => {
    const q: Record<string, string> = {};
    if (params?.level) q.level = params.level;
    if (params?.academicYear) q.academicYear = params.academicYear;
    if (params?.trackId === null) q.trackId = 'null';
    else if (params?.trackId) q.trackId = params.trackId;
    const response = await api.get('/admin/school-curricula', { params: q });
    return response.data;
  },
  getSchoolCurriculumById: async (id: string) => {
    const response = await api.get(`/admin/school-curricula/${id}`);
    return response.data;
  },
  createSchoolCurriculum: async (data: {
    level: string;
    academicYear: string;
    trackId?: string | null;
    label?: string | null;
    notes?: string | null;
  }) => {
    const response = await api.post('/admin/school-curricula', data);
    return response.data;
  },
  updateSchoolCurriculum: async (
    id: string,
    data: { label?: string | null; notes?: string | null; trackId?: string | null }
  ) => {
    const response = await api.patch(`/admin/school-curricula/${id}`, data);
    return response.data;
  },
  deleteSchoolCurriculum: async (id: string) => {
    const response = await api.delete(`/admin/school-curricula/${id}`);
    return response.data;
  },
  createSchoolCurriculumSubject: async (
    curriculumId: string,
    data: {
      name: string;
      code: string;
      weeklyHours?: number | null;
      gradingCoefficient?: number | null;
      sortOrder?: number;
      description?: string | null;
    }
  ) => {
    const response = await api.post(`/admin/school-curricula/${curriculumId}/subjects`, data);
    return response.data;
  },
  updateSchoolCurriculumSubject: async (
    subjectId: string,
    data: Partial<{
      name: string;
      code: string;
      weeklyHours: number | null;
      gradingCoefficient: number | null;
      sortOrder: number;
      description: string | null;
    }>
  ) => {
    const response = await api.patch(`/admin/school-curriculum-subjects/${subjectId}`, data);
    return response.data;
  },
  deleteSchoolCurriculumSubject: async (subjectId: string) => {
    const response = await api.delete(`/admin/school-curriculum-subjects/${subjectId}`);
    return response.data;
  },
  getSchoolCalendarEvents: async (params?: { academicYear?: string }) => {
    const response = await api.get('/admin/school-calendar-events', { params });
    return response.data;
  },
  createSchoolCalendarEvent: async (data: {
    title: string;
    description?: string | null;
    type?: 'HOLIDAY' | 'VACATION' | 'EXAM_PERIOD' | 'MEETING' | 'OTHER';
    startDate: string;
    endDate: string;
    academicYear: string;
    allDay?: boolean;
  }) => {
    const response = await api.post('/admin/school-calendar-events', data);
    return response.data;
  },
  updateSchoolCalendarEvent: async (
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      type: 'HOLIDAY' | 'VACATION' | 'EXAM_PERIOD' | 'MEETING' | 'OTHER';
      startDate: string;
      endDate: string;
      academicYear: string;
      allDay: boolean;
    }>
  ) => {
    const response = await api.put(`/admin/school-calendar-events/${id}`, data);
    return response.data;
  },
  deleteSchoolCalendarEvent: async (id: string) => {
    const response = await api.delete(`/admin/school-calendar-events/${id}`);
    return response.data;
  },
  takeAttendance: async (data: {
    courseId: string;
    date: string;
    attendance: Array<{
      studentId: string;
      status: string;
      excused?: boolean;
      reason?: string;
      minutesLate?: number;
      justificationDocuments?: string[];
      hasMedicalCertificate?: boolean;
      sanctionNote?: string;
      attendanceSource?: string;
    }>;
    notifyParentsOnSave?: boolean;
    attendanceSource?: string;
  }) => {
    const response = await api.post('/admin/absences/take-attendance', data);
    return response.data;
  },
  getCourseAbsences: async (courseId: string, date?: string) => {
    const response = await api.get('/admin/absences', { params: { courseId, date } });
    return response.data;
  },
  initAttendance: async (data: { courseId: string; date: string }) => {
    const response = await api.post('/admin/absences/init-attendance', data);
    return response.data;
  },
  recordNFCAttendance: async (data: {
    courseId: string;
    studentId: string;
    date: string;
    status?: 'PRESENT' | 'ABSENT' | 'LATE';
    minutesLate?: number;
    attendanceSource?: 'NFC' | 'BIOMETRIC' | 'MANUAL';
    notifyParentsOnSave?: boolean;
  }) => {
    const response = await api.post('/admin/absences/nfc-attendance', data);
    return response.data;
  },
  // Grades Management
  getGrade: async (id: string) => {
    const response = await api.get(`/admin/grades/${id}`);
    return response.data;
  },
  createGrade: async (data: any) => {
    const response = await api.post('/admin/grades', data);
    return response.data;
  },
  updateGrade: async (id: string, data: any) => {
    const response = await api.put(`/admin/grades/${id}`, data);
    return response.data;
  },
  deleteGrade: async (id: string) => {
    const response = await api.delete(`/admin/grades/${id}`);
    return response.data;
  },
  // Absences Management
  getAbsence: async (id: string) => {
    const response = await api.get(`/admin/absences/${id}`);
    return response.data;
  },
  createAbsence: async (data: any) => {
    const response = await api.post('/admin/absences', data);
    return response.data;
  },
  updateAbsence: async (id: string, data: any) => {
    const response = await api.put(`/admin/absences/${id}`, data);
    return response.data;
  },
  deleteAbsence: async (id: string) => {
    const response = await api.delete(`/admin/absences/${id}`);
    return response.data;
  },
  getAbsenceStats: async (params?: { classId?: string; from?: string; to?: string }) => {
    const response = await api.get('/admin/absences/stats', { params });
    return response.data;
  },
  notifyAbsenceParents: async (absenceId: string) => {
    const response = await api.post(`/admin/absences/${absenceId}/notify-parents`);
    return response.data;
  },
  // Assignments Management
  getAssignment: async (id: string) => {
    const response = await api.get(`/admin/assignments/${id}`);
    return response.data;
  },
  createAssignment: async (data: any) => {
    const response = await api.post('/admin/assignments', data);
    return response.data;
  },
  updateAssignment: async (id: string, data: any) => {
    const response = await api.put(`/admin/assignments/${id}`, data);
    return response.data;
  },
  deleteAssignment: async (id: string) => {
    const response = await api.delete(`/admin/assignments/${id}`);
    return response.data;
  },
  getAllUsers: async (params?: { role?: string; isActive?: boolean }) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },
  updateUserRole: async (userId: string, role: string) => {
    const response = await api.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  },
  getRoleStats: async () => {
    const response = await api.get('/admin/roles/stats');
    return response.data;
  },
  getUser: async (id: string) => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },
  updateUser: async (id: string, data: any) => {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
  },
  deleteUser: async (id: string) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },
  getLibraryBooks: async (params?: { search?: string; category?: string; isActive?: string }) => {
    const response = await api.get('/admin/library/books', { params });
    return response.data;
  },
  createLibraryBook: async (data: {
    isbn?: string | null;
    title: string;
    author: string;
    publisher?: string | null;
    publicationYear?: number | null;
    category?: string | null;
    description?: string | null;
    copiesTotal?: number;
    copiesAvailable?: number;
    shelfLocation?: string | null;
  }) => {
    const response = await api.post('/admin/library/books', data);
    return response.data;
  },
  updateLibraryBook: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/library/books/${id}`, data);
    return response.data;
  },
  deleteLibraryBook: async (id: string) => {
    const response = await api.delete(`/admin/library/books/${id}`);
    return response.data;
  },
  getLibraryLoans: async (params?: { status?: 'ACTIVE' | 'RETURNED' }) => {
    const response = await api.get('/admin/library/loans', { params });
    return response.data;
  },
  searchLibraryBorrowers: async (q: string) => {
    const response = await api.get('/admin/library/borrowers/search', { params: { q } });
    return response.data;
  },
  createLibraryLoan: async (data: {
    bookId: string;
    borrowerId: string;
    dueDate: string;
    notes?: string | null;
  }) => {
    const response = await api.post('/admin/library/loans', data);
    return response.data;
  },
  createLibraryLoansBatch: async (data: {
    bookIds: string[];
    borrowerId: string;
    dueDate: string;
    notes?: string | null;
  }) => {
    const response = await api.post('/admin/library/loans/batch', data);
    return response.data;
  },
  returnLibraryLoan: async (loanId: string) => {
    const response = await api.patch(`/admin/library/loans/${loanId}/return`);
    return response.data;
  },
  getLibraryReservations: async (params?: { status?: string }) => {
    const response = await api.get('/admin/library/reservations', { params });
    return response.data;
  },
  createLibraryReservation: async (data: { bookId: string; userId: string }) => {
    const response = await api.post('/admin/library/reservations', data);
    return response.data;
  },
  updateLibraryReservation: async (
    id: string,
    data: { status: 'PENDING' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' }
  ) => {
    const response = await api.patch(`/admin/library/reservations/${id}`, data);
    return response.data;
  },
  getLibraryPenalties: async (params?: { paid?: string }) => {
    const response = await api.get('/admin/library/penalties', { params });
    return response.data;
  },
  createLibraryPenalty: async (data: {
    loanId?: string | null;
    userId: string;
    amount: number;
    reason: string;
    notes?: string | null;
  }) => {
    const response = await api.post('/admin/library/penalties', data);
    return response.data;
  },
  updateLibraryPenalty: async (
    id: string,
    data: { paid?: boolean; waived?: boolean; notes?: string | null }
  ) => {
    const response = await api.patch(`/admin/library/penalties/${id}`, data);
    return response.data;
  },
  getMaterialRooms: async (params?: { search?: string; isActive?: string }) => {
    const response = await api.get('/admin/material/rooms', { params });
    return response.data;
  },
  createMaterialRoom: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/rooms', data);
    return response.data;
  },
  updateMaterialRoom: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/material/rooms/${id}`, data);
    return response.data;
  },
  deleteMaterialRoom: async (id: string) => {
    const response = await api.delete(`/admin/material/rooms/${id}`);
    return response.data;
  },
  getMaterialEquipment: async (params?: {
    search?: string;
    category?: string;
    roomId?: string;
    isActive?: string;
  }) => {
    const response = await api.get('/admin/material/equipment', { params });
    return response.data;
  },
  createMaterialEquipment: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/equipment', data);
    return response.data;
  },
  updateMaterialEquipment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/material/equipment/${id}`, data);
    return response.data;
  },
  deleteMaterialEquipment: async (id: string) => {
    const response = await api.delete(`/admin/material/equipment/${id}`);
    return response.data;
  },
  getMaterialMaintenance: async (params?: { status?: string; equipmentId?: string; roomId?: string }) => {
    const response = await api.get('/admin/material/maintenance', { params });
    return response.data;
  },
  createMaterialMaintenance: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/maintenance', data);
    return response.data;
  },
  updateMaterialMaintenance: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/material/maintenance/${id}`, data);
    return response.data;
  },
  getMaterialAllocations: async (params?: { status?: string; equipmentId?: string }) => {
    const response = await api.get('/admin/material/allocations', { params });
    return response.data;
  },
  createMaterialAllocation: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/allocations', data);
    return response.data;
  },
  updateMaterialAllocation: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/material/allocations/${id}`, data);
    return response.data;
  },
  getMaterialRoomReservations: async (params?: {
    roomId?: string;
    from?: string;
    to?: string;
    status?: string;
  }) => {
    const response = await api.get('/admin/material/room-reservations', { params });
    return response.data;
  },
  createMaterialRoomReservation: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/room-reservations', data);
    return response.data;
  },
  updateMaterialRoomReservation: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/material/room-reservations/${id}`, data);
    return response.data;
  },
  deleteMaterialRoomReservation: async (id: string) => {
    const response = await api.delete(`/admin/material/room-reservations/${id}`);
    return response.data;
  },
  getMaterialRoomUnavailableSlots: async (params?: { roomKey?: string }) => {
    const response = await api.get('/admin/material/room-unavailable-slots', { params });
    return response.data;
  },
  createMaterialRoomUnavailableSlot: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/room-unavailable-slots', data);
    return response.data;
  },
  deleteMaterialRoomUnavailableSlot: async (id: string) => {
    const response = await api.delete(`/admin/material/room-unavailable-slots/${id}`);
    return response.data;
  },
  getMaterialRoomOccupancy: async (roomId: string, params?: { from?: string; to?: string; academicYear?: string }) => {
    const response = await api.get(`/admin/material/rooms/${roomId}/occupancy`, { params });
    return response.data;
  },
  getMaterialStockItems: async (params?: {
    search?: string;
    type?: string;
    lowStockOnly?: string;
    isActive?: string;
  }) => {
    const response = await api.get('/admin/material/stock-items', { params });
    return response.data;
  },
  createMaterialStockItem: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/stock-items', data);
    return response.data;
  },
  updateMaterialStockItem: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/material/stock-items/${id}`, data);
    return response.data;
  },
  getMaterialStockMovements: async (itemId: string) => {
    const response = await api.get(`/admin/material/stock-items/${itemId}/movements`);
    return response.data;
  },
  createMaterialStockMovement: async (itemId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/admin/material/stock-items/${itemId}/movements`, data);
    return response.data;
  },
  getMaterialStockOrders: async (params?: { status?: string }) => {
    const response = await api.get('/admin/material/stock-orders', { params });
    return response.data;
  },
  createMaterialStockOrder: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/material/stock-orders', data);
    return response.data;
  },
  updateMaterialStockOrder: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/material/stock-orders/${id}`, data);
    return response.data;
  },
  getMaterialStockPeriodicInventories: async (params?: { from?: string; to?: string; type?: string }) => {
    const response = await api.get('/admin/material/stock-periodic-inventories', { params });
    return response.data;
  },
  getReportsSummary: async () => {
    const response = await api.get('/admin/reports/summary');
    return response.data;
  },
  getAcademicReports: async (params?: { academicYear?: string; classId?: string; period?: string }) => {
    const response = await api.get('/admin/reports/academic', { params });
    return response.data;
  },
  getAdministrativeReports: async (params?: { academicYear?: string; from?: string; to?: string }) => {
    const response = await api.get('/admin/reports/administrative', { params });
    return response.data;
  },
  getFinancialReports: async (params?: { academicYear?: string; from?: string; to?: string }) => {
    const response = await api.get('/admin/reports/financial', { params });
    return response.data;
  },
  toggleUserStatus: async (id: string, isActive: boolean) => {
    const response = await api.put(`/admin/security/users/${id}/status`, { isActive });
    return response.data;
  },
  getClassStats: async (classId: string) => {
    const response = await api.get('/admin/pedagogical/class-stats', { params: { classId } });
    return response.data;
  },
  getStudentProgress: async (studentId: string, period?: string) => {
    const response = await api.get(`/admin/pedagogical/student-progress/${studentId}`, {
      params: { period },
    });
    return response.data;
  },
  getCourseStats: async (params?: { courseId?: string; classId?: string }) => {
    const response = await api.get('/admin/pedagogical/course-stats', { params });
    return response.data;
  },
  getStudentsAtRisk: async (classId?: string) => {
    const response = await api.get('/admin/pedagogical/students-at-risk', {
      params: classId ? { classId } : {},
    });
    return response.data;
  },
  getMessages: async (params?: { userId?: string; unread?: boolean }) => {
    const response = await api.get('/admin/messages', { params });
    return response.data;
  },
  sendMessage: async (data: {
    receiverId?: string;
    subject?: string;
    content: string;
    category?: string;
    channels?: string[];
    threadKey?: string;
    attachmentUrls?: string[];
    broadcastClassId?: string;
    broadcastLevel?: string;
    academicYear?: string;
  }) => {
    const response = await api.post('/admin/messages', data);
    return response.data;
  },
  markMessageAsRead: async (messageId: string) => {
    const response = await api.put(`/admin/messages/${messageId}/read`);
    return response.data;
  },
  getAnnouncements: async (params?: { published?: boolean; targetRole?: string; targetClass?: string }) => {
    const response = await api.get('/admin/announcements', { params });
    return response.data;
  },
  createAnnouncement: async (data: any) => {
    const response = await api.post('/admin/announcements', data);
    return response.data;
  },
  publishAnnouncement: async (announcementId: string) => {
    const response = await api.put(`/admin/announcements/${announcementId}/publish`);
    return response.data;
  },
  getNotifications: async (params?: { userId?: string; unread?: boolean }) => {
    const response = await api.get('/admin/notifications', { params });
    return response.data;
  },
  markNotificationAsRead: async (notificationId: string) => {
    const response = await api.put(`/admin/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async (userId?: string) => {
    const params = userId ? { userId } : {};
    const response = await api.put('/admin/notifications/read-all', {}, { params });
    return response.data;
  },
  deleteNotification: async (notificationId: string) => {
    const response = await api.delete(`/admin/notifications/${notificationId}`);
    return response.data;
  },
  getNotificationsChannelStatus: async () => {
    const response = await api.get('/admin/notifications/channel-status');
    return response.data as {
      pushWeb: boolean;
      emailSmtp: boolean;
      smsTwilio: boolean;
      attendanceParentNotify: boolean;
      announcementUrgentSms: boolean;
      tuitionSmsOverdue: boolean;
    };
  },
  testNotificationsChannels: async () => {
    const response = await api.post('/admin/notifications/test', {});
    return response.data as { ok: boolean };
  },
  deleteMessage: async (messageId: string) => {
    const response = await api.delete(`/admin/messages/${messageId}`);
    return response.data;
  },
  updateAnnouncement: async (announcementId: string, data: any) => {
    const response = await api.put(`/admin/announcements/${announcementId}`, data);
    return response.data;
  },
  deleteAnnouncement: async (announcementId: string) => {
    const response = await api.delete(`/admin/announcements/${announcementId}`);
    return response.data;
  },
  getMessage: async (messageId: string) => {
    const response = await api.get(`/admin/messages/${messageId}`);
    return response.data;
  },
  getAnnouncement: async (announcementId: string) => {
    const response = await api.get(`/admin/announcements/${announcementId}`);
    return response.data;
  },
  getSchoolGalleryItems: async () => {
    const response = await api.get('/admin/school-gallery-items');
    return response.data;
  },
  createSchoolGalleryItem: async (data: {
    title?: string | null;
    caption?: string | null;
    imageUrl: string;
    sortOrder?: number;
    published?: boolean;
  }) => {
    const response = await api.post('/admin/school-gallery-items', data);
    return response.data;
  },
  updateSchoolGalleryItem: async (
    id: string,
    data: Partial<{
      title: string | null;
      caption: string | null;
      imageUrl: string;
      sortOrder: number;
      published: boolean;
    }>
  ) => {
    const response = await api.put(`/admin/school-gallery-items/${id}`, data);
    return response.data;
  },
  deleteSchoolGalleryItem: async (id: string) => {
    const response = await api.delete(`/admin/school-gallery-items/${id}`);
    return response.data;
  },
  getSchedules: async (params?: {
    classId?: string;
    courseId?: string;
    teacherId?: string;
    room?: string;
  }) => {
    const response = await api.get('/admin/schedules', { params });
    return response.data;
  },
  getSchedule: async (id: string) => {
    const response = await api.get(`/admin/schedules/${id}`);
    return response.data;
  },
  createSchedule: async (data: any) => {
    const response = await api.post('/admin/schedules', data);
    return response.data;
  },
  updateSchedule: async (id: string, data: any) => {
    const response = await api.put(`/admin/schedules/${id}`, data);
    return response.data;
  },
  deleteSchedule: async (id: string) => {
    const response = await api.delete(`/admin/schedules/${id}`);
    return response.data;
  },
  autoGenerateSchedules: async (data: {
    classId: string;
    clearExisting?: boolean;
    days?: number[];
    slotDurationMinutes?: number;
    morningStart?: string;
    morningEnd?: string;
    afternoonStart?: string;
    afternoonEnd?: string;
  }) => {
    const response = await api.post('/admin/schedules/auto-generate', data);
    return response.data;
  },
  getTeacherScheduleAvailability: async (teacherId: string) => {
    const response = await api.get(`/admin/teachers/${teacherId}/schedule-availability`);
    return response.data;
  },
  createTeacherScheduleAvailability: async (
    teacherId: string,
    data: { dayOfWeek: number; startTime: string; endTime: string; label?: string }
  ) => {
    const response = await api.post(`/admin/teachers/${teacherId}/schedule-availability`, data);
    return response.data;
  },
  deleteTeacherScheduleAvailability: async (teacherId: string, slotId: string) => {
    const response = await api.delete(`/admin/teachers/${teacherId}/schedule-availability/${slotId}`);
    return response.data;
  },
  getScheduleRoomBlocks: async () => {
    const response = await api.get('/admin/schedule-room-blocks');
    return response.data;
  },
  createScheduleRoomBlock: async (data: {
    room: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    reason?: string;
  }) => {
    const response = await api.post('/admin/schedule-room-blocks', data);
    return response.data;
  },
  deleteScheduleRoomBlock: async (blockId: string) => {
    const response = await api.delete(`/admin/schedule-room-blocks/${blockId}`);
    return response.data;
  },
  getLoginLogs: async (params?: { userId?: string; limit?: number }) => {
    const response = await api.get('/admin/security/login-logs', { params });
    return response.data;
  },
  getSecurityEvents: async (params?: { userId?: string; severity?: string; limit?: number }) => {
    const response = await api.get('/admin/security/events', { params });
    return response.data;
  },
  getAuditLogs: async (params?: {
    limit?: number;
    skip?: number;
    entityType?: string;
    entityId?: string;
    action?: string;
    actorUserId?: string;
  }) => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data as {
      items: Array<{
        id: string;
        actorUserId: string | null;
        actorEmail: string | null;
        actorRole: string | null;
        action: string;
        entityType: string;
        entityId: string;
        summary: string;
        changes: Record<string, { before: unknown; after: unknown }> | null;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: string;
      }>;
      total: number;
      skip: number;
      take: number;
    };
  },
  getSecurityStats: async () => {
    const response = await api.get('/admin/security/stats');
    return response.data;
  },
  getRolePermissionsOverview: async () => {
    const response = await api.get('/admin/security/role-permissions');
    return response.data;
  },
  getTwoFactorUsers: async () => {
    const response = await api.get('/admin/security/2fa/users');
    return response.data;
  },
  getSlowEndpoints: async (params?: { limit?: number }) => {
    const response = await api.get('/admin/security/performance/slow-endpoints', { params });
    return response.data;
  },
  setUserTwoFactorEnabled: async (userId: string, enabled: boolean) => {
    const response = await api.patch(`/admin/security/2fa/users/${userId}`, { enabled });
    return response.data;
  },
  getDataProtectionSummary: async () => {
    const response = await api.get('/admin/security/data-protection-summary');
    return response.data;
  },
  runMongoBackupNow: async () => {
    const response = await api.post('/admin/security/backups/run');
    return response.data;
  },
  changeUserPassword: async (userId: string, newPassword: string) => {
    const response = await api.put(`/admin/security/users/${userId}/password`, { newPassword });
    return response.data;
  },
  sendUserPasswordInvite: async (userId: string) => {
    const response = await api.post(`/admin/security/users/${userId}/password-invite`);
    return response.data;
  },
  changeUserStatus: async (userId: string, isActive: boolean) => {
    const response = await api.put(`/admin/security/users/${userId}/status`, { isActive });
    return response.data;
  },
  // Report Cards
  generateReportCardData: async (params: { classId: string; period: string; academicYear: string }) => {
    const response = await api.get('/admin/report-cards/generate-data', { params });
    return response.data;
  },
  saveReportCards: async (data: {
    classId: string;
    period: string;
    academicYear: string;
    publish?: boolean;
  }) => {
    const response = await api.post('/admin/report-cards/save', data);
    return response.data;
  },
  getReportCards: async (params?: {
    classId?: string;
    period?: string;
    academicYear?: string;
    limit?: number;
  }) => {
    const response = await api.get('/admin/report-cards', { params });
    return response.data;
  },
  getDefaultReportCardTemplate: async () => {
    const response = await api.get('/admin/report-cards/template/default');
    return response.data;
  },
  saveDefaultReportCardTemplate: async (data: {
    name?: string;
    description?: string;
    settings?: Record<string, unknown>;
  }) => {
    const response = await api.put('/admin/report-cards/template/default', data);
    return response.data;
  },
  getGradeHistory: async (studentId: string) => {
    const response = await api.get(`/admin/grades/history/${studentId}`);
    return response.data;
  },
  getGradeRankings: async (params: { classId: string; period: string; academicYear: string }) => {
    const response = await api.get('/admin/grades/rankings', { params });
    return response.data;
  },
  getClassCouncils: async (params?: { classId?: string; period?: string; academicYear?: string }) => {
    const response = await api.get('/admin/class-councils', { params });
    return response.data;
  },
  createClassCouncil: async (data: {
    classId: string;
    period: string;
    academicYear: string;
    title?: string;
    meetingDate: string;
    summary?: string;
    decisions?: string;
    recommendations?: string;
  }) => {
    const response = await api.post('/admin/class-councils', data);
    return response.data;
  },
  updateClassCouncil: async (
    id: string,
    data: {
      title?: string;
      meetingDate?: string;
      summary?: string;
      decisions?: string;
      recommendations?: string;
    }
  ) => {
    const response = await api.put(`/admin/class-councils/${id}`, data);
    return response.data;
  },
  // Frais de scolarité
  getTuitionFees: async (params?: {
    studentId?: string;
    classId?: string;
    academicYear?: string;
    period?: string;
    isPaid?: boolean;
    grouped?: boolean;
    feeType?: string;
  }) => {
    const response = await api.get('/admin/tuition-fees', { params });
    return response.data;
  },
  getTuitionFeesGrouped: async (params?: {
    studentId?: string;
    classId?: string;
    academicYear?: string;
    period?: string;
    isPaid?: boolean;
    feeType?: string;
  }) => {
    const response = await api.get('/admin/tuition-fees', { params: { ...params, grouped: true } });
    return response.data;
  },
  createTuitionFee: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/tuition-fees', data);
    return response.data;
  },
  createTuitionFeesBulk: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/tuition-fees/bulk', data);
    return response.data;
  },
  updateTuitionFee: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/tuition-fees/${id}`, data);
    return response.data;
  },
  deleteTuitionFee: async (id: string) => {
    const response = await api.delete(`/admin/tuition-fees/${id}`);
    return response.data;
  },
  createTestTuitionFees: async () => {
    const response = await api.post('/admin/tuition-fees/create-test');
    return response.data;
  },
  getPaymentsGrouped: async () => {
    const response = await api.get('/admin/payments/grouped');
    return response.data;
  },
  getPayments: async () => {
    const response = await api.get('/admin/payments');
    return response.data;
  },
  assignTuitionFeeInvoices: async (data?: {
    academicYear?: string;
    prefix?: string;
    limit?: number;
  }) => {
    const response = await api.post('/admin/tuition-fees/assign-invoices', data ?? {});
    return response.data;
  },
  runTuitionFeeAutoReminders: async () => {
    const response = await api.post('/admin/tuition-fees/run-reminders', {});
    return response.data;
  },
  recordCounterTuitionPayment: async (data: {
    tuitionFeeId: string;
    amount: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    notes?: string;
  }) => {
    const response = await api.post('/admin/tuition-fees/counter-payment', data);
    return response.data;
  },
  getEducators: async () => {
    const response = await api.get('/admin/educators');
    return response.data;
  },
  getEducator: async (id: string) => {
    const response = await api.get(`/admin/educators/${id}`);
    return response.data;
  },
  createEducator: async (data: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    employeeId: string;
    specialization: string;
    hireDate: string;
    contractType?: string;
    salary?: number;
  }) => {
    const response = await api.post('/admin/educators', data);
    return response.data;
  },
  updateEducator: async (id: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    specialization?: string;
    contractType?: string;
    salary?: number;
  }) => {
    const response = await api.put(`/admin/educators/${id}`, data);
    return response.data;
  },
  deleteEducator: async (id: string) => {
    const response = await api.delete(`/admin/educators/${id}`);
    return response.data;
  },

  getStaffJobDescriptions: async () => {
    const response = await api.get('/admin/staff/job-descriptions');
    return response.data;
  },
  createStaffJobDescription: async (data: {
    title: string;
    responsibilities: string;
    code?: string | null;
    summary?: string | null;
    requirements?: string | null;
    suggestedCategory?: 'ADMINISTRATION' | 'SUPPORT' | 'SECURITY' | null;
    suggestedCategoryOther?: string | null;
    isActive?: boolean;
  }) => {
    const response = await api.post('/admin/staff/job-descriptions', data);
    return response.data;
  },
  updateStaffJobDescription: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/staff/job-descriptions/${id}`, data);
    return response.data;
  },
  deleteStaffJobDescription: async (id: string) => {
    const response = await api.delete(`/admin/staff/job-descriptions/${id}`);
    return response.data;
  },
  getStaffOrgChart: async () => {
    const response = await api.get('/admin/staff/org-chart');
    return response.data;
  },
  getStaffMembers: async () => {
    const response = await api.get('/admin/staff');
    return response.data;
  },
  getStaffMember: async (id: string) => {
    const response = await api.get(`/admin/staff/${id}`);
    return response.data;
  },
  createStaffMember: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/staff', data);
    return response.data;
  },
  updateStaffMember: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/staff/${id}`, data);
    return response.data;
  },
  deleteStaffMember: async (id: string) => {
    const response = await api.delete(`/admin/staff/${id}`);
    return response.data;
  },
  getStaffAttendances: async (staffId: string, params?: { from?: string; to?: string }) => {
    const response = await api.get(`/admin/staff/${staffId}/attendances`, { params });
    return response.data;
  },
  recordStaffAttendance: async (staffId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/admin/staff/${staffId}/attendances`, data);
    return response.data;
  },
  deleteStaffAttendance: async (staffId: string, attendanceId: string) => {
    const response = await api.delete(`/admin/staff/${staffId}/attendances/${attendanceId}`);
    return response.data;
  },

  getAdmissions: async (params?: { status?: string; academicYear?: string }) => {
    const response = await api.get('/admin/admissions', { params });
    return response.data;
  },
  getAdmissionStats: async () => {
    const response = await api.get('/admin/admissions/stats');
    return response.data;
  },
  getAdmission: async (id: string) => {
    const response = await api.get(`/admin/admissions/${id}`);
    return response.data;
  },
  updateAdmission: async (
    id: string,
    data: {
      status?: string;
      adminNotes?: string;
      proposedClassId?: string | null;
    }
  ) => {
    const response = await api.patch(`/admin/admissions/${id}`, data);
    return response.data;
  },
  enrollFromAdmission: async (
    id: string,
    data: {
      password?: string;
      studentId?: string;
      classId?: string;
      address?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      medicalInfo?: string;
      stateAssignment?: 'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED';
    }
  ) => {
    const response = await api.post(`/admin/admissions/${id}/enroll`, data);
    return response.data;
  },
  getStudentIdentityDocuments: async (studentId: string) => {
    const response = await api.get(`/admin/students/${studentId}/identity-documents`);
    return response.data;
  },
  deleteStudentIdentityDocument: async (studentId: string, documentId: string) => {
    const response = await api.delete(
      `/admin/students/${studentId}/identity-documents/${documentId}`
    );
    return response.data;
  },
  getStudentDigitalCard: async (studentId: string) => {
    const response = await api.get(`/admin/students/${studentId}/digital-card`);
    return response.data as { publicId: string; cardPageUrl: string; qrDataUrl: string };
  },
  addStudentSchoolHistory: async (
    studentId: string,
    data: {
      academicYear: string;
      className?: string;
      classLevel?: string;
      establishment?: string;
      notes?: string;
      classId?: string;
    }
  ) => {
    const response = await api.post(`/admin/students/${studentId}/school-history`, data);
    return response.data;
  },
  deleteStudentSchoolHistory: async (studentId: string, historyId: string) => {
    const response = await api.delete(
      `/admin/students/${studentId}/school-history/${historyId}`
    );
    return response.data;
  },
  recordStudentTransfer: async (
    studentId: string,
    data: {
      effectiveDate: string;
      transferType: 'CLASS_CHANGE' | 'REENROLLMENT' | 'MUTATION' | 'DEPARTURE';
      toClassId?: string | null;
      reason?: string;
      notes?: string;
    }
  ) => {
    const response = await api.post(`/admin/students/${studentId}/transfer`, data);
    return response.data;
  },
  archiveStudent: async (studentId: string) => {
    const response = await api.post(`/admin/students/${studentId}/archive`);
    return response.data;
  },
  getDisciplineRulebooks: async () => {
    const response = await api.get('/admin/discipline/rulebooks');
    return response.data;
  },
  createDisciplineRulebook: async (data: {
    title?: string;
    content: string;
    academicYear?: string;
    effectiveFrom?: string;
    isPublished?: boolean;
    sortOrder?: number;
  }) => {
    const response = await api.post('/admin/discipline/rulebooks', data);
    return response.data;
  },
  updateDisciplineRulebook: async (
    id: string,
    data: Partial<{
      title: string;
      content: string;
      academicYear: string | null;
      effectiveFrom: string;
      isPublished: boolean;
      sortOrder: number;
    }>
  ) => {
    const response = await api.put(`/admin/discipline/rulebooks/${id}`, data);
    return response.data;
  },
  deleteDisciplineRulebook: async (id: string) => {
    const response = await api.delete(`/admin/discipline/rulebooks/${id}`);
    return response.data;
  },
  getDisciplineRecords: async (params?: {
    studentId?: string;
    classId?: string;
    academicYear?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get('/admin/discipline/records', { params });
    return response.data;
  },
  createDisciplineRecord: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/discipline/records', data);
    return response.data;
  },
  updateDisciplineRecord: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/discipline/records/${id}`, data);
    return response.data;
  },
  deleteDisciplineRecord: async (id: string) => {
    const response = await api.delete(`/admin/discipline/records/${id}`);
    return response.data;
  },

  getExtracurricularOfferings: async (params?: {
    academicYear?: string;
    kind?: 'CLUB' | 'EVENT';
    category?: string;
    classId?: string;
    publishedOnly?: boolean;
  }) => {
    const response = await api.get('/admin/extracurricular/offerings', { params });
    return response.data;
  },
  createExtracurricularOffering: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/extracurricular/offerings', data);
    return response.data;
  },
  updateExtracurricularOffering: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/extracurricular/offerings/${id}`, data);
    return response.data;
  },
  deleteExtracurricularOffering: async (id: string) => {
    const response = await api.delete(`/admin/extracurricular/offerings/${id}`);
    return response.data;
  },
  getExtracurricularOfferingRegistrations: async (offeringId: string) => {
    const response = await api.get(`/admin/extracurricular/offerings/${offeringId}/registrations`);
    return response.data;
  },
  createExtracurricularRegistration: async (data: { studentId: string; offeringId: string }) => {
    const response = await api.post('/admin/extracurricular/registrations', data);
    return response.data;
  },
  deleteExtracurricularRegistration: async (id: string) => {
    const response = await api.delete(`/admin/extracurricular/registrations/${id}`);
    return response.data;
  },

  getOrientationFilieres: async (params?: { publishedOnly?: boolean }) => {
    const response = await api.get('/admin/orientation/filieres', { params });
    return response.data;
  },
  createOrientationFiliere: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/orientation/filieres', data);
    return response.data;
  },
  updateOrientationFiliere: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/orientation/filieres/${id}`, data);
    return response.data;
  },
  deleteOrientationFiliere: async (id: string) => {
    const response = await api.delete(`/admin/orientation/filieres/${id}`);
    return response.data;
  },
  getOrientationPartnerships: async (params?: { publishedOnly?: boolean }) => {
    const response = await api.get('/admin/orientation/partnerships', { params });
    return response.data;
  },
  createOrientationPartnership: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/orientation/partnerships', data);
    return response.data;
  },
  updateOrientationPartnership: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/orientation/partnerships/${id}`, data);
    return response.data;
  },
  deleteOrientationPartnership: async (id: string) => {
    const response = await api.delete(`/admin/orientation/partnerships/${id}`);
    return response.data;
  },
  getOrientationAptitudeTests: async (params?: { publishedOnly?: boolean; academicYear?: string }) => {
    const response = await api.get('/admin/orientation/aptitude-tests', { params });
    return response.data;
  },
  createOrientationAptitudeTest: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/orientation/aptitude-tests', data);
    return response.data;
  },
  updateOrientationAptitudeTest: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/orientation/aptitude-tests/${id}`, data);
    return response.data;
  },
  deleteOrientationAptitudeTest: async (id: string) => {
    const response = await api.delete(`/admin/orientation/aptitude-tests/${id}`);
    return response.data;
  },
  getOrientationAdvice: async (params?: { publishedOnly?: boolean }) => {
    const response = await api.get('/admin/orientation/advice', { params });
    return response.data;
  },
  createOrientationAdvice: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/orientation/advice', data);
    return response.data;
  },
  updateOrientationAdvice: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/orientation/advice/${id}`, data);
    return response.data;
  },
  deleteOrientationAdvice: async (id: string) => {
    const response = await api.delete(`/admin/orientation/advice/${id}`);
    return response.data;
  },
  getOrientationFollowUps: async (params?: { studentId?: string; academicYear?: string }) => {
    const response = await api.get('/admin/orientation/follow-ups', { params });
    return response.data;
  },
  createOrientationFollowUp: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/orientation/follow-ups', data);
    return response.data;
  },
  updateOrientationFollowUp: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/orientation/follow-ups/${id}`, data);
    return response.data;
  },
  deleteOrientationFollowUp: async (id: string) => {
    const response = await api.delete(`/admin/orientation/follow-ups/${id}`);
    return response.data;
  },
  getOrientationPlacements: async (params?: { studentId?: string }) => {
    const response = await api.get('/admin/orientation/placements', { params });
    return response.data;
  },
  createOrientationPlacement: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/orientation/placements', data);
    return response.data;
  },
  updateOrientationPlacement: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/orientation/placements/${id}`, data);
    return response.data;
  },
  deleteOrientationPlacement: async (id: string) => {
    const response = await api.delete(`/admin/orientation/placements/${id}`);
    return response.data;
  },
  getAppBranding: async () => {
    const response = await api.get('/admin/app-branding');
    return response.data;
  },
  updateAppBranding: async (data: Record<string, unknown>) => {
    const response = await api.put('/admin/app-branding', data);
    return response.data;
  },
  uploadAppBrandingFile: async (slot: AppBrandingUploadSlot, file: File) => {
    const formData = new FormData();
    formData.append('branding', file);
    const response = await api.post(
      `/admin/app-branding/upload?slot=${encodeURIComponent(slot)}`,
      formData
    );
    return response.data;
  },
  getAdminWorkspaceContext: async () => {
    const response = await api.get('/admin/workspaces/my-context');
    return response.data;
  },
  getAdminWorkspaces: async () => {
    const response = await api.get('/admin/workspaces');
    return response.data;
  },
  createAdminWorkspace: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/workspaces', data);
    return response.data;
  },
  updateAdminWorkspace: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/workspaces/${id}`, data);
    return response.data;
  },
  deactivateAdminWorkspace: async (id: string) => {
    const response = await api.delete(`/admin/workspaces/${id}`);
    return response.data;
  },
  listSchools: async () => {
    const response = await api.get('/admin/schools');
    return response.data;
  },
  setActiveSchool: async (schoolId: string) => {
    const response = await api.put('/admin/schools/active', { schoolId });
    return response.data;
  },
  listSchoolsManage: async () => {
    const response = await api.get('/admin/schools/manage');
    return response.data;
  },
  createSchool: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/schools', data);
    return response.data;
  },
  updateSchool: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/schools/${id}`, data);
    return response.data;
  },
};
export const teacherApi = {
  getProfile: async () => {
    const response = await api.get('/teacher/profile');
    return response.data;
  },
  getSchedule: async () => {
    const response = await api.get('/teacher/schedule');
    return response.data;
  },
  getPerformanceReviews: async () => {
    const response = await api.get('/teacher/performance-reviews');
    return response.data;
  },
  getLeaves: async () => {
    const response = await api.get('/teacher/leaves');
    return response.data;
  },
  createLeave: async (data: {
    type: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'TRAINING' | 'OTHER';
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    const response = await api.post('/teacher/leaves', data);
    return response.data;
  },
  cancelLeave: async (leaveId: string) => {
    const response = await api.patch(`/teacher/leaves/${leaveId}/cancel`);
    return response.data;
  },
  getCourses: async () => {
    const response = await api.get('/teacher/courses');
    return response.data;
  },
  getDashboardKpis: async () => {
    const response = await api.get('/teacher/dashboard/kpis');
    return response.data;
  },
  getMyAttendance: async (params?: { date?: string }) => {
    const response = await api.get('/teacher/my-attendance', { params });
    return response.data;
  },
  markMyAttendancePresent: async (data?: { date?: string }) => {
    const response = await api.post('/teacher/my-attendance/mark-present', data ?? {});
    return response.data;
  },
  getStudentByNFC: async (nfcId: string) => {
    const response = await api.get(`/teacher/students/nfc/${nfcId}`);
    return response.data;
  },
  getCourseGrades: async (courseId: string) => {
    const response = await api.get(`/teacher/courses/${courseId}/grades`);
    return response.data;
  },
  createGrade: async (data: any) => {
    const response = await api.post('/teacher/grades', data);
    return response.data;
  },
  updateGrade: async (id: string, data: any) => {
    const response = await api.put(`/teacher/grades/${id}`, data);
    return response.data;
  },
  deleteGrade: async (id: string) => {
    const response = await api.delete(`/teacher/grades/${id}`);
    return response.data;
  },
  takeAttendance: async (data: any) => {
    const response = await api.post('/teacher/absences/take-attendance', data);
    return response.data;
  },
  initAttendance: async (data: { courseId: string; date: string }) => {
    const response = await api.post('/teacher/absences/init-attendance', data);
    return response.data;
  },
  recordNFCAttendance: async (data: { courseId: string; studentId: string; date: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }) => {
    const response = await api.post('/teacher/absences/nfc-attendance', data);
    return response.data;
  },
  getCourseAbsences: async (courseId: string, date?: string) => {
    const response = await api.get(`/teacher/courses/${courseId}/absences`, {
      params: { date },
    });
    return response.data;
  },
  createAssignment: async (data: any) => {
    const response = await api.post('/teacher/assignments', data);
    return response.data;
  },
  getCourseAssignments: async (courseId: string) => {
    const response = await api.get(`/teacher/courses/${courseId}/assignments`);
    return response.data;
  },
  // Conduite (Professeur Principal)
  getConduct: async (params?: { period?: string; academicYear?: string }) => {
    const response = await api.get('/teacher/conduct', { params });
    return response.data;
  },
  createConduct: async (data: any) => {
    const response = await api.post('/teacher/conduct', data);
    return response.data;
  },
  updateConduct: async (id: string, data: any) => {
    const response = await api.put(`/teacher/conduct/${id}`, data);
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/teacher/notifications');
    return response.data;
  },
  markNotificationAsRead: async (notificationId: string) => {
    const response = await api.put(`/teacher/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.put('/teacher/notifications/read-all');
    return response.data;
  },
  getAppointments: async () => {
    const response = await api.get('/teacher/appointments');
    return response.data;
  },
  confirmAppointment: async (appointmentId: string, notesTeacher?: string | null) => {
    const response = await api.put(`/teacher/appointments/${appointmentId}/confirm`, {
      notesTeacher: notesTeacher ?? undefined,
    });
    return response.data;
  },
  declineAppointment: async (appointmentId: string, reason?: string | null) => {
    const response = await api.put(`/teacher/appointments/${appointmentId}/decline`, {
      reason: reason ?? undefined,
    });
    return response.data;
  },
  cancelTeacherAppointment: async (appointmentId: string) => {
    const response = await api.put(`/teacher/appointments/${appointmentId}/cancel`);
    return response.data;
  },
  getMessagingThreads: async () => {
    const response = await api.get('/teacher/messaging/threads');
    return response.data;
  },
  getMessagingThread: async (threadKey: string) => {
    const response = await api.get('/teacher/messaging/thread', { params: { threadKey } });
    return response.data;
  },
  getMessagingContacts: async () => {
    const response = await api.get('/teacher/messaging/contacts');
    return response.data;
  },
  sendMessagingMessage: async (data: {
    receiverId?: string;
    subject?: string;
    content: string;
    category?: string;
    threadKey?: string;
    attachmentUrls?: string[];
    broadcastClassId?: string;
  }) => {
    const response = await api.post('/teacher/messaging/send', data);
    return response.data;
  },
  markMessagingMessageRead: async (messageId: string) => {
    const response = await api.put(`/teacher/messaging/${messageId}/read`);
    return response.data;
  },
};

export const studentApi = {
  getProfile: async () => {
    const response = await api.get('/student/profile');
    return response.data;
  },
  updateProfile: async (data: {
    address?: string | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    medicalInfo?: string | null;
  }) => {
    const response = await api.put('/student/profile', data);
    return response.data;
  },
  getGrades: async () => {
    const response = await api.get('/student/grades');
    return response.data;
  },
  getSchedule: async () => {
    const response = await api.get('/student/schedule');
    return response.data;
  },
  getAbsences: async () => {
    const response = await api.get('/student/absences');
    return response.data;
  },
  getAssignments: async () => {
    const response = await api.get('/student/assignments');
    return response.data;
  },
  submitAssignment: async (assignmentId: string, fileUrl: string) => {
    const response = await api.post(`/student/assignments/${assignmentId}/submit`, {
      fileUrl,
    });
    return response.data;
  },
  getMessages: async (params?: { unread?: boolean }) => {
    const response = await api.get('/student/messages', { params });
    return response.data;
  },
  sendSchoolMessage: async (data: {
    subject?: string;
    content: string;
    category?: string;
    attachmentUrls?: string[];
  }) => {
    const response = await api.post('/student/messages', data);
    return response.data;
  },
  markMessageAsRead: async (messageId: string) => {
    const response = await api.put(`/student/messages/${messageId}/read`);
    return response.data;
  },
  getAnnouncements: async () => {
    const response = await api.get('/student/announcements');
    return response.data;
  },
  getSchoolCalendarEvents: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/school-calendar-events', { params });
    return response.data;
  },
  getPortalFeed: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/portal-feed', { params });
    return response.data;
  },
  getReportCards: async (params?: { period?: string; academicYear?: string }) => {
    const response = await api.get('/student/report-cards', { params });
    return response.data;
  },
  getConduct: async (params?: { period?: string; academicYear?: string }) => {
    const response = await api.get('/student/conduct', { params });
    return response.data;
  },
  getDisciplineRulebook: async () => {
    const response = await api.get('/student/discipline/rulebook');
    return response.data;
  },
  getDisciplineRecords: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/discipline/records', { params });
    return response.data;
  },
  getAcademicHistory: async () => {
    const response = await api.get('/student/academic-history');
    return response.data;
  },
  getIdentityDocuments: async () => {
    const response = await api.get('/student/identity-documents');
    return response.data;
  },
  deleteIdentityDocument: async (documentId: string) => {
    const response = await api.delete(`/student/identity-documents/${documentId}`);
    return response.data;
  },
  justifyAbsence: async (absenceId: string, documentUrl: string, reason?: string) => {
    const response = await api.put(`/student/absences/${absenceId}/justify`, {
      documentUrl,
      reason,
    });
    return response.data;
  },
  getTuitionFees: async () => {
    const response = await api.get('/student/tuition-fees');
    return response.data;
  },
  createPayment: async (tuitionFeeId: string, paymentMethod: string, amount: number, phoneNumber?: string, operator?: string, transactionCode?: string) => {
    const response = await api.post('/student/payments', {
      tuitionFeeId,
      paymentMethod,
      amount,
      phoneNumber,
      operator,
      transactionCode,
    });
    return response.data;
  },
  confirmPayment: async (paymentId: string, transactionId?: string) => {
    const response = await api.post(`/student/payments/${paymentId}/confirm`, {
      transactionId,
    });
    return response.data;
  },
  getPayments: async () => {
    const response = await api.get('/student/payments');
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/student/notifications');
    return response.data;
  },
  markNotificationAsRead: async (notificationId: string) => {
    const response = await api.put(`/student/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.put('/student/notifications/read-all');
    return response.data;
  },
  getExtracurricularOfferings: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/extracurricular/offerings', { params });
    return response.data;
  },
  getExtracurricularRegistrations: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/extracurricular/registrations', { params });
    return response.data;
  },
  createExtracurricularRegistration: async (offeringId: string) => {
    const response = await api.post('/student/extracurricular/registrations', { offeringId });
    return response.data;
  },
  deleteExtracurricularRegistration: async (id: string) => {
    const response = await api.delete(`/student/extracurricular/registrations/${id}`);
    return response.data;
  },
  getOrientationCatalog: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/orientation/catalog', { params });
    return response.data;
  },
  getOrientationFollowUps: async (params?: { academicYear?: string }) => {
    const response = await api.get('/student/orientation/follow-ups', { params });
    return response.data;
  },
  getOrientationPlacements: async () => {
    const response = await api.get('/student/orientation/placements');
    return response.data;
  },
};

export const parentApi = {
  getChildren: async () => {
    const response = await api.get('/parent/children');
    return response.data;
  },
  getDashboardKpis: async () => {
    const response = await api.get('/parent/dashboard/kpis');
    return response.data;
  },
  getChildTuitionFees: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/tuition-fees`);
    return response.data;
  },
  createPayment: async (studentId: string, tuitionFeeId: string, paymentMethod: string, amount: number, phoneNumber?: string, operator?: string, transactionCode?: string) => {
    const response = await api.post(`/parent/children/${studentId}/payments`, {
      tuitionFeeId,
      paymentMethod,
      amount,
      phoneNumber,
      operator,
      transactionCode,
    });
    return response.data;
  },
  confirmPayment: async (studentId: string, paymentId: string, transactionId?: string) => {
    const response = await api.post(`/parent/children/${studentId}/payments/${paymentId}/confirm`, {
      transactionId,
    });
    return response.data;
  },
  getChildPayments: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/payments`);
    return response.data;
  },
  getChildGrades: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/grades`);
    return response.data;
  },
  getChildAbsences: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/absences`);
    return response.data;
  },
  getChildSchedule: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/schedule`);
    return response.data;
  },
  getChildAssignments: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/assignments`);
    return response.data;
  },
  getChildReportCards: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/report-cards`);
    return response.data;
  },
  getChildConduct: async (studentId: string, params?: { period?: string; academicYear?: string }) => {
    const response = await api.get(`/parent/children/${studentId}/conduct`, { params });
    return response.data;
  },
  getMessages: async (params?: { unread?: boolean }) => {
    const response = await api.get('/parent/messages', { params });
    return response.data;
  },
  getMessageThreads: async () => {
    const response = await api.get('/parent/messages/threads');
    return response.data;
  },
  getMessageThread: async (threadKey: string) => {
    const response = await api.get('/parent/messages/thread', { params: { threadKey } });
    return response.data;
  },
  getMessageContacts: async () => {
    const response = await api.get('/parent/messages/contacts');
    return response.data;
  },
  sendSchoolMessage: async (data: {
    subject?: string;
    content: string;
    category?: string;
    studentId?: string;
    receiverId?: string;
    threadKey?: string;
    attachmentUrls?: string[];
  }) => {
    const response = await api.post('/parent/messages', data);
    return response.data;
  },
  markMessageAsRead: async (messageId: string) => {
    const response = await api.put(`/parent/messages/${messageId}/read`);
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/parent/notifications');
    return response.data;
  },
  markNotificationAsRead: async (notificationId: string) => {
    const response = await api.put(`/parent/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.put('/parent/notifications/read-all');
    return response.data;
  },
  getAnnouncements: async () => {
    const response = await api.get('/parent/announcements');
    return response.data;
  },
  getSchoolCalendarEvents: async (params?: { academicYear?: string }) => {
    const response = await api.get('/parent/school-calendar-events', { params });
    return response.data;
  },
  getPortalFeed: async (params?: { academicYear?: string }) => {
    const response = await api.get('/parent/portal-feed', { params });
    return response.data;
  },
  getAppointments: async () => {
    const response = await api.get('/parent/appointments');
    return response.data;
  },
  getAppointmentTeachers: async (studentId: string) => {
    const response = await api.get(`/parent/appointment-teachers/${studentId}`);
    return response.data;
  },
  createAppointment: async (data: {
    studentId: string;
    teacherId: string;
    scheduledStart: string;
    durationMinutes?: number;
    topic?: string;
    notesParent?: string;
  }) => {
    const response = await api.post('/parent/appointments', data);
    return response.data;
  },
  cancelParentAppointment: async (appointmentId: string) => {
    const response = await api.put(`/parent/appointments/${appointmentId}/cancel`);
    return response.data;
  },
  rescheduleParentAppointment: async (
    appointmentId: string,
    data: { scheduledStart: string; durationMinutes?: number }
  ) => {
    const response = await api.put(`/parent/appointments/${appointmentId}/reschedule`, data);
    return response.data;
  },
  getDisciplineRulebook: async () => {
    const response = await api.get('/parent/discipline/rulebook');
    return response.data;
  },
  getChildDisciplineRecords: async (studentId: string, params?: { academicYear?: string }) => {
    const response = await api.get(`/parent/children/${studentId}/discipline-records`, { params });
    return response.data;
  },
  getChildExtracurricularOfferings: async (studentId: string, params?: { academicYear?: string }) => {
    const response = await api.get(`/parent/children/${studentId}/extracurricular-offerings`, { params });
    return response.data;
  },
  getChildExtracurricularRegistrations: async (studentId: string, params?: { academicYear?: string }) => {
    const response = await api.get(`/parent/children/${studentId}/extracurricular-registrations`, { params });
    return response.data;
  },
  createChildExtracurricularRegistration: async (studentId: string, offeringId: string) => {
    const response = await api.post(`/parent/children/${studentId}/extracurricular-registrations`, {
      offeringId,
    });
    return response.data;
  },
  deleteChildExtracurricularRegistration: async (studentId: string, regId: string) => {
    const response = await api.delete(
      `/parent/children/${studentId}/extracurricular-registrations/${regId}`
    );
    return response.data;
  },
  getOrientationCatalog: async (params?: { academicYear?: string }) => {
    const response = await api.get('/parent/orientation/catalog', { params });
    return response.data;
  },
  getChildOrientationFollowUps: async (studentId: string, params?: { academicYear?: string }) => {
    const response = await api.get(`/parent/children/${studentId}/orientation/follow-ups`, { params });
    return response.data;
  },
  getChildOrientationPlacements: async (studentId: string) => {
    const response = await api.get(`/parent/children/${studentId}/orientation/placements`);
    return response.data;
  },
};

export const educatorApi = {
  getProfile: async () => {
    const response = await api.get('/educator/profile');
    return response.data;
  },
  updateProfile: async (data: { phone?: string; avatar?: string }) => {
    const response = await api.put('/educator/profile', data);
    return response.data;
  },
  getStudents: async (params?: { classId?: string }) => {
    const response = await api.get('/educator/students', { params });
    return response.data;
  },
  getStudent: async (studentId: string) => {
    const response = await api.get(`/educator/students/${studentId}`);
    return response.data;
  },
  getConducts: async (params?: { studentId?: string; period?: string; academicYear?: string }) => {
    const response = await api.get('/educator/conducts', { params });
    return response.data;
  },
  getConduct: async (conductId: string) => {
    const response = await api.get(`/educator/conducts/${conductId}`);
    return response.data;
  },
  createConduct: async (data: {
    studentId: string;
    period: string;
    academicYear: string;
    punctuality: number;
    respect: number;
    participation: number;
    behavior: number;
    comments?: string;
  }) => {
    const response = await api.post('/educator/conducts', data);
    return response.data;
  },
  updateConduct: async (conductId: string, data: {
    punctuality?: number;
    respect?: number;
    participation?: number;
    behavior?: number;
    comments?: string;
  }) => {
    const response = await api.put(`/educator/conducts/${conductId}`, data);
    return response.data;
  },
  deleteConduct: async (conductId: string) => {
    const response = await api.delete(`/educator/conducts/${conductId}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/educator/stats');
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/educator/notifications');
    return response.data;
  },
  markNotificationAsRead: async (notificationId: string) => {
    const response = await api.put(`/educator/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.put('/educator/notifications/read-all');
    return response.data;
  },
  getClasses: async () => {
    const response = await api.get('/educator/classes');
    return response.data;
  },
  getTeachers: async () => {
    const response = await api.get('/educator/teachers');
    return response.data;
  },
  getParents: async (params?: { classId?: string }) => {
    const response = await api.get('/educator/parents', { params });
    return response.data;
  },
  getSchedules: async (params?: { classId?: string; teacherId?: string }) => {
    const response = await api.get('/educator/schedules', { params });
    return response.data;
  },
  getMessagingThreads: async () => {
    const response = await api.get('/educator/messaging/threads');
    return response.data;
  },
  getMessagingThread: async (threadKey: string) => {
    const response = await api.get('/educator/messaging/thread', { params: { threadKey } });
    return response.data;
  },
  getMessagingContacts: async () => {
    const response = await api.get('/educator/messaging/contacts');
    return response.data;
  },
  sendMessagingMessage: async (data: {
    receiverId?: string;
    subject?: string;
    content: string;
    category?: string;
    threadKey?: string;
    attachmentUrls?: string[];
    broadcastClassId?: string;
    broadcastAudience?: 'parents' | 'students' | 'all';
  }) => {
    const response = await api.post('/educator/messaging/send', data);
    return response.data;
  },
  markMessagingMessageRead: async (messageId: string) => {
    const response = await api.put(`/educator/messaging/${messageId}/read`);
    return response.data;
  },
};

/** Upload multipart : pièce d'identité (champ fichier `identityDocument`, champs `type`, `label?`, `notes?`, `studentId?` si admin) */
export const uploadIdentityDocument = async (formData: FormData) => {
  const response = await api.post('/upload/identity-document', formData);
  return response.data;
};

export const uploadTeacherAdministrativeDocument = async (formData: FormData) => {
  const response = await api.post('/upload/teacher-admin-document', formData);
  return response.data;
};

export default api;

