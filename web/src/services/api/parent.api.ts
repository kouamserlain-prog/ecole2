import api from './client';

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
  deleteNotification: async (notificationId: string) => {
    const response = await api.delete(`/parent/notifications/${notificationId}`);
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
    const response = await api.get("/parent/discipline/rulebook");
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
