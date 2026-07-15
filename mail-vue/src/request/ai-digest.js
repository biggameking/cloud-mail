import http from '@/axios/index.js';

export const aiDigestList = () => http.get('/ai/digests');
export const aiDigestDetail = digestId => http.get(`/ai/digests/${digestId}`);
export const aiDigestSource = (digestId, emailId) => http.get(`/ai/digests/${digestId}/source/${emailId}`);
export const aiDigestPreview = monitorId => http.post('/ai/digests/preview', {monitorId}, {timeout: 120000});
export const aiUsageToday = () => http.get('/ai/usage/today');
export const aiRunList = () => http.get('/ai/runs');
export const aiDigestDelete = digestId => http.delete(`/ai/digests/${digestId}`);
export const aiDigestSetRetained = (digestId, retained) => http.put(`/ai/digests/${digestId}/retained`, {retained});
