import api from './client';

export type TuitionLevelRateRow = {
  level: string;
  amount: number | null;
  catalogId: string | null;
};

export const adminTuitionCatalogApi = {
  getLevelTuitionRates: async (academicYear: string) => {
    const response = await api.get('/admin/tuition-level-rates', {
      params: { academicYear },
    });
    return response.data as {
      academicYear: string;
      levels: string[];
      rates: TuitionLevelRateRow[];
    };
  },
  saveLevelTuitionRates: async (data: {
    academicYear: string;
    rates: { level: string; amount: number }[];
  }) => {
    const response = await api.put('/admin/tuition-level-rates', data);
    return response.data;
  },
  resolveTuitionForStudent: async (studentId: string, academicYear: string) => {
    const response = await api.get('/admin/tuition-level-rates/resolve', {
      params: { studentId, academicYear },
    });
    return response.data as { amount: number; classLevel: string; catalogId: string };
  },
  getTuitionFeeCatalog: async () => {
    const response = await api.get('/admin/tuition-fee-catalog');
    return response.data;
  },
  createTuitionFeeCatalog: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/tuition-fee-catalog', data);
    return response.data;
  },
  updateTuitionFeeCatalog: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/tuition-fee-catalog/${id}`, data);
    return response.data;
  },
  deleteTuitionFeeCatalog: async (id: string) => {
    const response = await api.delete(`/admin/tuition-fee-catalog/${id}`);
    return response.data;
  },
  getScheduleTemplates: async () => {
    const response = await api.get('/admin/tuition-payment-schedule-templates');
    return response.data;
  },
  createScheduleTemplate: async (data: { name: string; description?: string; academicYear?: string; lines: unknown[]; isActive?: boolean }) => {
    const response = await api.post('/admin/tuition-payment-schedule-templates', data);
    return response.data;
  },
  updateScheduleTemplate: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/tuition-payment-schedule-templates/${id}`, data);
    return response.data;
  },
  deleteScheduleTemplate: async (id: string) => {
    const response = await api.delete(`/admin/tuition-payment-schedule-templates/${id}`);
    return response.data;
  },
  applyCatalogToStudents: async (data: {
    catalogId: string;
    academicYear: string;
    anchorDueDate: string;
    classId?: string;
    studentIds?: string[];
    discountAmount?: number;
    scholarshipLabel?: string;
    descriptionExtra?: string;
  }) => {
    const response = await api.post('/admin/tuition-fee-catalog/apply-to-students', data);
    return response.data;
  },
  applyScheduleToStudent: async (data: {
    scheduleTemplateId: string;
    studentId: string;
    academicYear: string;
    anchorDueDate: string;
    /** Montant brut à répartir (avant remise globale) */
    totalAmount: number;
    /** Remise totale répartie sur les lignes au prorata des % du gabarit */
    discountAmount?: number;
    feeType?: string;
    scholarshipLabel?: string;
    catalogId?: string;
  }) => {
    const response = await api.post('/admin/tuition-payment-schedule-templates/apply-to-student', data);
    return response.data;
  },
};
