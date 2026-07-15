import http from '@/axios/index.js';

export const aiMonitorList = () => http.get('/ai/monitors');
export const aiMonitorAccounts = () => http.get('/ai/accounts');
export const aiMonitorCreate = data => http.post('/ai/monitors', data);
export const aiMonitorUpdate = (monitorId, data) => http.put(`/ai/monitors/${monitorId}`, data);
export const aiMonitorDelete = monitorId => http.delete(`/ai/monitors/${monitorId}`);
