import api from '../../api/client';

// All results CRUD calls live here.
export const resultsApi = {
  getAll: (params) => api.get('/results', { params }),
  getById: (id) => api.get(`/results/${id}`),
  create: (data) => api.post('/results', data),
  update: (id, data) => api.put(`/results/${id}`, data),
  remove: (id) => api.delete(`/results/${id}`),
  getExamSlip: (params) => api.get('/results/exam-slip', { params }),
  // NECTA-style Division Performance reports.
  // params: { exam_id, school_class_id, stream_id? }
  getClassReport: (params) => api.get('/results/class-report', { params }),
  // params: { exam_id }
  getSchoolReport: (params) => api.get('/results/school-report', { params }),
};
