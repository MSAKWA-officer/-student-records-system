import api from '../../api/client';

// All student CRUD calls live here, in one place.
// If you need to change the URL or how the API is called, change it only here.
export const studentsApi = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  remove: (id) => api.delete(`/students/${id}`),
  enroll: (id, data) => api.post(`/students/${id}/enroll`, data),
  getReportCard: (id, params) => api.get(`/students/${id}/report-card`, { params }),
  createLogin: (id, data) => api.post(`/students/${id}/create-login`, data),
};