import api from './client';
import type { DigitalResourceRow } from './digitalLibrary.api';
import type { LibraryBorrowerRow } from '@/components/library/LibraryBorrowerSearch';

export type LibraryLoansBatchResult = {
  loans?: unknown[];
  count?: number;
};

export type LibraryManagementApi = {
  getLibraryBooks: (params?: { search?: string; category?: string; isActive?: string }) => Promise<unknown>;
  createLibraryBook: (data: Record<string, unknown>) => Promise<unknown>;
  updateLibraryBook: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  deleteLibraryBook: (id: string) => Promise<unknown>;
  getLibraryLoans: (params?: { status?: 'ACTIVE' | 'RETURNED' }) => Promise<unknown>;
  searchLibraryBorrowers: (q: string) => Promise<LibraryBorrowerRow[]>;
  createLibraryLoan: (data: {
    bookId: string;
    borrowerId: string;
    dueDate: string;
    notes?: string;
  }) => Promise<unknown>;
  createLibraryLoansBatch: (data: {
    bookIds: string[];
    borrowerId: string;
    dueDate: string;
    notes?: string;
  }) => Promise<LibraryLoansBatchResult>;
  returnLibraryLoan: (loanId: string) => Promise<unknown>;
  getLibraryReservations: (params?: { status?: string }) => Promise<unknown>;
  createLibraryReservation: (data: { bookId: string; userId: string }) => Promise<unknown>;
  updateLibraryReservation: (
    id: string,
    data: { status: 'FULFILLED' | 'CANCELLED' | 'PENDING' | 'READY' | 'EXPIRED' },
  ) => Promise<unknown>;
  getLibraryPenalties: (params?: { paid?: string }) => Promise<unknown>;
  createLibraryPenalty: (data: {
    loanId?: string | null;
    userId: string;
    amount: number;
    reason: string;
    notes?: string;
  }) => Promise<unknown>;
  updateLibraryPenalty: (
    id: string,
    data: { paid?: boolean; waived?: boolean; notes?: string | null },
  ) => Promise<unknown>;
  getAllUsers: (params?: { isActive?: boolean }) => Promise<unknown>;
};

export type DigitalLibraryManagementApi = {
  adminList: (params?: { kind?: string; q?: string; isActive?: string }) => Promise<DigitalResourceRow[]>;
  adminCreate: (data: Record<string, unknown>) => Promise<unknown>;
  adminUpdate: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  adminArchive: (id: string) => Promise<unknown>;
  adminUnarchive: (id: string) => Promise<unknown>;
};

export function createLibraryManagementApi(basePath: '/admin' | '/staff'): LibraryManagementApi {
  const prefix = `${basePath}/library`;
  return {
    getLibraryBooks: async (params) => (await api.get(`${prefix}/books`, { params })).data,
    createLibraryBook: async (data) => (await api.post(`${prefix}/books`, data)).data,
    updateLibraryBook: async (id, data) => (await api.put(`${prefix}/books/${id}`, data)).data,
    deleteLibraryBook: async (id) => (await api.delete(`${prefix}/books/${id}`)).data,
    getLibraryLoans: async (params) => (await api.get(`${prefix}/loans`, { params })).data,
    searchLibraryBorrowers: async (q) =>
      (await api.get(`${prefix}/borrowers/search`, { params: { q } })).data as LibraryBorrowerRow[],
    createLibraryLoan: async (data) => (await api.post(`${prefix}/loans`, data)).data,
    createLibraryLoansBatch: async (data) =>
      (await api.post(`${prefix}/loans/batch`, data)).data as LibraryLoansBatchResult,
    returnLibraryLoan: async (loanId) => (await api.patch(`${prefix}/loans/${loanId}/return`)).data,
    getLibraryReservations: async (params) => (await api.get(`${prefix}/reservations`, { params })).data,
    createLibraryReservation: async (data) => (await api.post(`${prefix}/reservations`, data)).data,
    updateLibraryReservation: async (id, data) =>
      (await api.patch(`${prefix}/reservations/${id}`, data)).data,
    getLibraryPenalties: async (params) => (await api.get(`${prefix}/penalties`, { params })).data,
    createLibraryPenalty: async (data) => (await api.post(`${prefix}/penalties`, data)).data,
    updateLibraryPenalty: async (id, data) => (await api.patch(`${prefix}/penalties/${id}`, data)).data,
    getAllUsers: async (params) => {
      if (basePath === '/admin') {
        return (
          await api.get('/admin/users', {
            params: { isActive: params?.isActive === false ? 'false' : 'true' },
          })
        ).data;
      }
      return (
        await api.get('/staff/library/users', {
          params: { isActive: params?.isActive === false ? 'false' : 'true' },
        })
      ).data;
    },
  };
}

export function createDigitalLibraryManagementApi(
  basePath: '/admin' | '/staff',
): DigitalLibraryManagementApi {
  const prefix = `${basePath}/library/digital-resources`;
  return {
    adminList: async (params) => (await api.get(prefix, { params })).data,
    adminCreate: async (data) => (await api.post(prefix, data)).data,
    adminUpdate: async (id, data) => (await api.put(`${prefix}/${id}`, data)).data,
    adminArchive: async (id) => (await api.delete(`${prefix}/${id}`)).data,
    adminUnarchive: async (id) => (await api.post(`${prefix}/${id}/restore`)).data,
  };
}

export const adminLibraryManagementApi = createLibraryManagementApi('/admin');
export const staffLibraryManagementApi = createLibraryManagementApi('/staff');
export const adminDigitalLibraryManagementApi = createDigitalLibraryManagementApi('/admin');
export const staffDigitalLibraryManagementApi = createDigitalLibraryManagementApi('/staff');
