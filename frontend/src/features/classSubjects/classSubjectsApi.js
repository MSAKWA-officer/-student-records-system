import api from '../../api/client';

// All subject-allocation (class-subject-teacher assignment) CRUD calls live here.
export const classSubjectsApi = {
  getAll: (params) => api.get('/class-subjects', { params }),
  getById: (id) => api.get(`/class-subjects/${id}`),
  create: (data) => api.post('/class-subjects', data),
  update: (id, data) => api.put(`/class-subjects/${id}`, data),
  remove: (id) => api.delete(`/class-subjects/${id}`),
};
