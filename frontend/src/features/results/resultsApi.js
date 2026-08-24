import api from '../../api/client';

// All results CRUD calls live here.
export const resultsApi = {
  getAll: (params) => api.get('/results', { params }),
  getById: (id) => api.get(`/results/${id}`),
  create: (data) => api.post('/results', data),
  update: (id, data) => api.put(`/results/${id}`, data),
  remove: (id) => api.delete(`/results/${id}`),
  getExamSlip: (params) => api.get('/results/exam-slip', { params }),
};
