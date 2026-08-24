import api from '../../api/client';

// All class-enrollment CRUD calls live here.
export const enrollmentsApi = {
  getAll: (params) => api.get('/enrollments', { params }),
  getById: (id) => api.get(`/enrollments/${id}`),
  create: (data) => api.post('/enrollments', data),
  update: (id, data) => api.put(`/enrollments/${id}`, data),
  remove: (id) => api.delete(`/enrollments/${id}`),
};
