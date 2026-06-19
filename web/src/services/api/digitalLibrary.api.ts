import api from './client';
import type { DigitalLibraryKind } from '@/lib/digitalLibraryKinds';

export type DigitalResourceRow = {
  id: string;
  title: string;
  author?: string | null;
  description?: string | null;
  kind: DigitalLibraryKind;
  coverImageUrl?: string | null;
  subject?: string | null;
  level?: string | null;
  onlineAccessEnabled: boolean;
  tempDownloadEnabled: boolean;
  downloadTtlHours: number;
  allowedRoles: string[];
  publishedAt?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  fileUrl?: string;
  isActive?: boolean;
};

export const digitalLibraryApi = {
  list: async (params?: { kind?: string; q?: string }) => {
    const response = await api.get('/digital-library/resources', { params });
    return response.data as DigitalResourceRow[];
  },
  viewUrl: (id: string) => `/api/digital-library/resources/${id}/view`,
  requestDownloadGrant: async (id: string) => {
    const response = await api.post(`/digital-library/resources/${id}/download-grant`);
    return response.data as {
      downloadUrl: string;
      expiresAt: string;
      ttlHours: number;
    };
  },
  adminList: async (params?: { kind?: string; q?: string; isActive?: string }) => {
    const response = await api.get('/admin/library/digital-resources', { params });
    return response.data as DigitalResourceRow[];
  },
  adminCreate: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/library/digital-resources', data);
    return response.data;
  },
  adminUpdate: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admin/library/digital-resources/${id}`, data);
    return response.data;
  },
  adminArchive: async (id: string) => {
    const response = await api.delete(`/admin/library/digital-resources/${id}`);
    return response.data;
  },
  adminUnarchive: async (id: string) => {
    const response = await api.post(`/admin/library/digital-resources/${id}/restore`);
    return response.data;
  },
};
