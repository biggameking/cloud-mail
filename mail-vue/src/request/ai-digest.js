import http from '@/axios/index.js';

export const aiDigestList = () => http.get('/ai/digests');
export const aiDigestDetail = digestId => http.get(`/ai/digests/${digestId}`);
export const aiDigestSource = (digestId, emailId) => http.get(`/ai/digests/${digestId}/source/${emailId}`);
export const aiDigestPreview = monitorId => http.post('/ai/digests/preview', {monitorId}, {timeout: 120000});
export const aiUsageToday = () => http.get('/ai/usage/today');
