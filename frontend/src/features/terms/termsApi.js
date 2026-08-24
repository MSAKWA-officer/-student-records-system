import api from '../../api/client';

// All term CRUD calls live here.
export const termsApi = {
  getAll: (params) => api.get('/terms', { params }),
  getById: (id) => api.get(`/terms/${id}`),
  create: (data) => api.post('/terms', data),
  update: (id, data) => api.put(`/terms/${id}`, data),
  remove: (id) => api.delete(`/terms/${id}`),
};
