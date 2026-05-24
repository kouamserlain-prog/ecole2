import api from './client';

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
    try {
      const response = await api.get(`/educator/students/${studentId}`);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403) throw error;
      if (status !== 404) throw error;

      // Fallback: certains écrans peuvent envoyer le matricule (studentId métier)
      // au lieu de l'identifiant technique; on résout alors l'ID puis on recharge.
      const listResponse = await api.get('/educator/students');
      const matched = (listResponse.data as any[])?.find(
        (s) => s?.studentId === studentId || s?.id === studentId
      );
      if (!matched?.id) throw error;

      const resolvedResponse = await api.get(`/educator/students/${matched.id}`);
      return resolvedResponse.data;
    }
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
    behavior: number;
    comments?: string;
  }) => {
    const response = await api.post('/educator/conducts', data);
    return response.data;
  },
  updateConduct: async (conductId: string, data: {
    punctuality?: number;
    respect?: number;
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
