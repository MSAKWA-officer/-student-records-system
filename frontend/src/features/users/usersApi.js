import api from '../../api/client';

// All User Management CRUD calls live here (admin only).
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, new_password) => api.put(`/users/${id}/reset-password`, { new_password }),
  remove: (id) => api.delete(`/users/${id}`),
};
