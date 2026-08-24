import api from '../../api/client';

// All class and stream CRUD calls live here.
export const classesApi = {
  getAll: () => api.get('/classes'),
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  remove: (id) => api.delete(`/classes/${id}`),

  getStreams: (classId) => api.get(`/classes/${classId}/streams`),
  addStream: (classId, data) => api.post(`/classes/${classId}/streams`, data),
  updateStream: (streamId, data) => api.put(`/classes/streams/${streamId}`, data),
  removeStream: (streamId) => api.delete(`/classes/streams/${streamId}`),
};
