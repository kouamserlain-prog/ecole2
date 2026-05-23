import api from './client';
import type { StaffModuleId } from '@/lib/staffModules';

export const staffApi = {
  getWorkspace: async () => {
    const response = await api.get('/staff/workspace');
    return response.data as {
      visibleModules: StaffModuleId[];
      supportKind: string | null;
      staffCategory: string;
    };
  },
  searchStudentsForCounter: async (q: string) => {
    const response = await api.get('/staff/counter-tuition/students', { params: { q } });
    return response.data;
  },
  getStudentTuitionFeesForCounter: async (studentId: string) => {
    const response = await api.get(`/staff/counter-tuition/students/${studentId}/tuition-fees`);
    return response.data;
  },
  recordCounterTuitionPayment: async (
    studentId: string,
    body: { tuitionFeeId: string; amount: number; paymentMethod: 'CASH' | 'BANK_TRANSFER'; notes?: string },
  ) => {
    const response = await api.post(`/staff/counter-tuition/students/${studentId}/payments`, body);
    return response.data;
  },
  searchStudents: async (q: string) => {
    const response = await api.get('/staff/students/search', { params: { q } });
    return response.data;
  },
  listModuleRecords: async (moduleKey: StaffModuleId) => {
    const response = await api.get('/staff/module-records', { params: { moduleKey } });
    return response.data;
  },
  createModuleRecord: async (body: {
    moduleKey: StaffModuleId;
    title: string;
    payload?: Record<string, unknown>;
    studentId?: string;
    status?: string;
  }) => {
    const response = await api.post('/staff/module-records', body);
    return response.data;
  },
  updateModuleRecord: async (
    id: string,
    body: { status?: string; title?: string; payload?: Record<string, unknown> },
  ) => {
    const response = await api.patch(`/staff/module-records/${id}`, body);
    return response.data;
  },
  listLibraryBooks: async (q?: string) => {
    const response = await api.get('/staff/library/books', { params: q ? { q } : {} });
    return response.data;
  },
  listLibraryLoans: async (status?: 'ACTIVE' | 'RETURNED') => {
    const response = await api.get('/staff/library/loans', { params: status ? { status } : {} });
    return response.data;
  },
  searchLibraryBorrowers: async (q: string) => {
    const response = await api.get('/staff/library/borrowers/search', { params: { q } });
    return response.data;
  },
  createLibraryLoan: async (body: { bookId: string; borrowerId: string; dueDate: string; notes?: string }) => {
    const response = await api.post('/staff/library/loans', body);
    return response.data;
  },
  createLibraryLoansBatch: async (body: {
    bookIds: string[];
    borrowerId: string;
    dueDate: string;
    notes?: string;
  }) => {
    const response = await api.post('/staff/library/loans/batch', body);
    return response.data;
  },
  returnLibraryLoan: async (loanId: string) => {
    const response = await api.patch(`/staff/library/loans/${loanId}/return`);
    return response.data;
  },
  getAdmissionsStats: async () => {
    const response = await api.get('/staff/admissions/stats');
    return response.data as { pending: number; underReview: number; accepted: number; total: number };
  },
  listAdmissions: async (params?: { status?: string; academicYear?: string; q?: string }) => {
    const response = await api.get('/staff/admissions', { params });
    return response.data;
  },
  listAdmissionClasses: async () => {
    const response = await api.get('/staff/admissions/classes');
    return response.data;
  },
  updateAdmission: async (
    id: string,
    body: { status?: string; adminNotes?: string; proposedClassId?: string | null },
  ) => {
    const response = await api.patch(`/staff/admissions/${id}`, body);
    return response.data;
  },
  enrollFromAdmission: async (
    id: string,
    data: {
      password?: string;
      studentId?: string;
      classId?: string;
      stateAssignment?: 'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED';
      address?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      medicalInfo?: string;
    },
  ) => {
    const response = await api.post(`/staff/admissions/${id}/enroll`, data);
    return response.data;
  },
  getAppointmentsStats: async () => {
    const response = await api.get('/staff/appointments/stats');
    return response.data as { pending: number; today: number; confirmed: number };
  },
  listAppointments: async (params?: { status?: string; from?: string; to?: string; q?: string }) => {
    const response = await api.get('/staff/appointments', { params });
    return response.data;
  },
  searchRegistryStudents: async (q: string) => {
    const response = await api.get('/staff/registry/students', { params: { q } });
    return response.data;
  },
  getRegistryStudent: async (id: string) => {
    const response = await api.get(`/staff/registry/students/${id}`);
    return response.data;
  },
  getTreasurySummary: async () => {
    const response = await api.get('/staff/treasury/summary');
    return response.data as {
      totalOutstanding: number;
      unpaidLines: number;
      overdueCount: number;
      collectedToday: number;
      paymentsTodayCount: number;
      collectedMonth: number;
      paymentsMonthCount: number;
    };
  },
  listTreasuryOverdue: async () => {
    const response = await api.get('/staff/treasury/overdue');
    return response.data;
  },
  listTreasuryRecentPayments: async () => {
    const response = await api.get('/staff/treasury/recent-payments');
    return response.data;
  },
  listPendingCashPayments: async () => {
    const response = await api.get('/staff/treasury/pending-cash');
    return response.data;
  },
  validateCashPayment: async (paymentId: string) => {
    const response = await api.post(`/staff/treasury/pending-cash/${paymentId}/validate`);
    return response.data;
  },
  rejectCashPayment: async (paymentId: string, reason?: string) => {
    const response = await api.post(`/staff/treasury/pending-cash/${paymentId}/reject`, { reason });
    return response.data;
  },
  getAcademicOverview: async () => {
    const response = await api.get('/staff/academic/overview');
    return response.data;
  },
  getClassAverages: async (classId?: string) => {
    const response = await api.get('/staff/academic/class-averages', { params: classId ? { classId } : {} });
    return response.data;
  },
  listClassCouncils: async (params?: { classId?: string; period?: string; academicYear?: string }) => {
    const response = await api.get('/staff/class-councils', { params });
    return response.data;
  },
  listCouncilClasses: async () => {
    const response = await api.get('/staff/class-councils/classes');
    return response.data;
  },
  createClassCouncil: async (body: Record<string, unknown>) => {
    const response = await api.post('/staff/class-councils', body);
    return response.data;
  },
  updateClassCouncil: async (id: string, body: Record<string, unknown>) => {
    const response = await api.patch(`/staff/class-councils/${id}`, body);
    return response.data;
  },
  getHealthMessagingThreads: async () => {
    const response = await api.get('/staff/health-messaging/threads');
    return response.data;
  },
  getHealthMessagingThread: async (threadKey: string) => {
    const response = await api.get('/staff/health-messaging/thread', { params: { threadKey } });
    return response.data;
  },
  getHealthMessagingContacts: async () => {
    const response = await api.get('/staff/health-messaging/contacts');
    return response.data;
  },
  sendHealthMessagingMessage: async (data: Record<string, unknown>) => {
    const response = await api.post('/staff/health-messaging/send', data);
    return response.data;
  },
  markHealthMessagingMessageRead: async (messageId: string) => {
    const response = await api.put(`/staff/health-messaging/${messageId}/read`);
    return response.data;
  },
  getNotifications: async (params?: { unread?: boolean }) => {
    const response = await api.get('/staff/notifications', { params });
    return response.data;
  },
  markNotificationAsRead: async (notificationId: string) => {
    const response = await api.put(`/staff/notifications/${notificationId}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.put('/staff/notifications/read-all');
    return response.data;
  },
  deleteNotification: async (notificationId: string) => {
    const response = await api.delete(`/staff/notifications/${notificationId}`);
    return response.data;
  },
  sendNotificationTest: async () => {
    const response = await api.post('/staff/notifications/test');
    return response.data;
  },
};

