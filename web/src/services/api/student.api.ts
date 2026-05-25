import api from './client';

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
