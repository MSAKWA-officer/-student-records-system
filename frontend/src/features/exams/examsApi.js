import api from '../../api/client';

// All exam CRUD calls live here.
export const examsApi = {
  getAll: (params) => api.get('/exams', { params }),
  getById: (id) => api.get(`/exams/${id}`),
  create: (data) => api.post('/exams', data),
  update: (id, data) => api.put(`/exams/${id}`, data),
  remove: (id) => api.delete(`/exams/${id}`),
};
