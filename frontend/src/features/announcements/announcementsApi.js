import api from '../../api/client';

// All Announcement CRUD calls live here — same pattern as teachersApi.js.
// Matches backend/src/routes/announcementRoutes.js:
//   GET    /api/announcements?audience=&active=
//   GET    /api/announcements/:id
//   POST   /api/announcements        { title, body, audience }
//   PUT    /api/announcements/:id
//   DELETE /api/announcements/:id
export const announcementsApi = {
  getAll: (params) => api.get('/announcements', { params }),
  getById: (id) => api.get(`/announcements/${id}`),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  remove: (id) => api.delete(`/announcements/${id}`),
};
