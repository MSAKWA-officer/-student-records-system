import api from '../../api/client';

// All attendance CRUD calls live here.
export const attendanceApi = {
  getAll: (params) => api.get('/attendance', { params }),
  getById: (id) => api.get(`/attendance/${id}`),
  create: (data) => api.post('/attendance', data),
  update: (id, data) => api.put(`/attendance/${id}`, data),
  remove: (id) => api.delete(`/attendance/${id}`),
};
