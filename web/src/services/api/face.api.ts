import api from './client';

export type FacePersonType = 'STUDENT' | 'TEACHER' | 'STAFF';

export const faceApi = {
  getStats: async () => {
    const response = await api.get('/face/stats');
    return response.data as {
      students: number;
      teachers: number;
      staff: number;
      total: number;
      matchThreshold: number;
    };
  },
  enroll: async (data: {
    personType: FacePersonType;
    personId: string;
    descriptor: number[];
  }) => {
    const response = await api.post('/face/enroll', data);
    return response.data;
  },
  removeEnrollment: async (personType: FacePersonType, personId: string) => {
    const response = await api.delete(`/face/enroll/${personType}/${personId}`);
    return response.data;
  },
  punch: async (data: {
    descriptor: number[];
    courseId?: string;
    date?: string;
    personType?: FacePersonType;
    notifyParentsOnSave?: boolean;
  }) => {
    const response = await api.post('/face/punch', data);
    return response.data;
  },
};
