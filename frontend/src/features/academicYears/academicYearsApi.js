import api from '../../api/client';

// All academic-year CRUD calls live here.
export const academicYearsApi = {
  getAll: () => api.get('/academic-years'),
  getById: (id) => api.get(`/academic-years/${id}`),
  create: (data) => api.post('/academic-years', data),
  update: (id, data) => api.put(`/academic-years/${id}`, data),
  remove: (id) => api.delete(`/academic-years/${id}`),
};
