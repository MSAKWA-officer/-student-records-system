import api from '../../api/client';

export const smsApi = {
  sendResultSms: (data) => api.post('/sms/send-result', data),
  sendClassResultsSms: (data) => api.post('/sms/send-class-results', data),
};