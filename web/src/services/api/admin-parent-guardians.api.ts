import api from './client';

/** Endpoints admin « Parents & tuteurs » (fichier séparé pour l’inférence TypeScript). */
export const adminParentGuardiansApi = {
  getParents: async () => {
    const response = await api.get('/admin/parents');
    return response.data;
  },
  createParent: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    phone?: string;
    profession?: string;
    studentId: string;
    relation?: 'father' | 'mother' | 'guardian' | 'other';
  }) => {
    const response = await api.post('/admin/parents', data);
    return response.data;
  },
  getParent: async (id: string) => {
    const response = await api.get(`/admin/parents/${id}`);
    return response.data;
  },
  updateParent: async (
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      isActive?: boolean;
      profession?: string | null;
      preferredLocale?: string | null;
      notifyEmail?: boolean;
      notifySms?: boolean;
      portalShowFees?: boolean;
      portalShowGrades?: boolean;
      portalShowAttendance?: boolean;
      internalNotes?: string | null;
    }
  ) => {
    const response = await api.put(`/admin/parents/${id}`, data);
    return response.data;
  },
  addParentContact: async (
    parentId: string,
    data: { label: string; phone?: string | null; email?: string | null; sortOrder?: number }
  ) => {
    const response = await api.post(`/admin/parents/${parentId}/contacts`, data);
    return response.data;
  },
  deleteParentContact: async (parentId: string, contactId: string) => {
    const response = await api.delete(`/admin/parents/${parentId}/contacts/${contactId}`);
    return response.data;
  },
  getParentInteractions: async (parentId: string) => {
    const response = await api.get(`/admin/parents/${parentId}/interactions`);
    return response.data;
  },
  addParentInteraction: async (
    parentId: string,
    data: { channel: string; subject?: string; body?: string }
  ) => {
    const response = await api.post(`/admin/parents/${parentId}/interactions`, data);
    return response.data;
  },
  deleteParentInteraction: async (parentId: string, interactionId: string) => {
    const response = await api.delete(`/admin/parents/${parentId}/interactions/${interactionId}`);
    return response.data;
  },
  upsertParentConsent: async (
    parentId: string,
    data: {
      studentId?: string | null;
      consentType: string;
      granted: boolean;
      policyVersion?: string | null;
      notes?: string | null;
    }
  ) => {
    const response = await api.post(`/admin/parents/${parentId}/consents/upsert`, data);
    return response.data;
  },
  deleteParentConsent: async (parentId: string, consentId: string) => {
    const response = await api.delete(`/admin/parents/${parentId}/consents/${consentId}`);
    return response.data;
  },
  addParentPickupAuthorization: async (
    parentId: string,
    data: {
      studentId: string;
      authorizedName: string;
      relationship?: string | null;
      phone?: string | null;
      identityNote?: string | null;
      validFrom?: string | null;
      validUntil?: string | null;
      isActive?: boolean;
    }
  ) => {
    const response = await api.post(`/admin/parents/${parentId}/pickup-authorizations`, data);
    return response.data;
  },
  updateParentPickupAuthorization: async (
    parentId: string,
    pickupId: string,
    data: {
      authorizedName?: string;
      relationship?: string | null;
      phone?: string | null;
      identityNote?: string | null;
      validFrom?: string | null;
      validUntil?: string | null;
      isActive?: boolean;
    }
  ) => {
    const response = await api.put(`/admin/parents/${parentId}/pickup-authorizations/${pickupId}`, data);
    return response.data;
  },
  deleteParentPickupAuthorization: async (parentId: string, pickupId: string) => {
    const response = await api.delete(`/admin/parents/${parentId}/pickup-authorizations/${pickupId}`);
    return response.data;
  },
  linkParentStudent: async (
    parentId: string,
    data: { studentId: string; relation?: 'father' | 'mother' | 'guardian' | 'other' }
  ) => {
    const response = await api.post(`/admin/parents/${parentId}/students`, data);
    return response.data;
  },
  unlinkParentStudent: async (parentId: string, studentId: string) => {
    const response = await api.delete(`/admin/parents/${parentId}/students/${studentId}`);
    return response.data;
  },
};
