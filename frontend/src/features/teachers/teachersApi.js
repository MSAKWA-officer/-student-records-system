import api from '../../api/client';

// All teacher CRUD calls live here.
export const teachersApi = {
  getAll: (params) => api.get('/teachers', { params }),
  getById: (id) => api.get(`/teachers/${id}`),
  create: (data) => api.post('/teachers', data),
  update: (id, data) => api.put(`/teachers/${id}`, data),
  remove: (id) => api.delete(`/teachers/${id}`),
  createLogin: (id, data) => api.post(`/teachers/${id}/create-login`, data),
};
