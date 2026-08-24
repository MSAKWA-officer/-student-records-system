import api from '../../api/client';

// All subject CRUD calls live here.
export const subjectsApi = {
  getAll: (params) => api.get('/subjects', { params }),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  remove: (id) => api.delete(`/subjects/${id}`),
};