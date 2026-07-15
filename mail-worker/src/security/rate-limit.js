import BizError from '../error/biz-error';
import reqUtils from '../utils/req-utils';
import app from '../hono/hono';

const RULES = [
	{ method: 'POST', path: '/login', limit: 5, windowSeconds: 600 },
	{ method: 'POST', path: '/register', limit: 3, windowSeconds: 3600 },
	{ method: 'POST', path: '/email/send', limit: 30, windowSeconds: 60 },
	{ method: 'POST', path: '/account/add', limit: 20, windowSeconds: 3600 },
	{ method: 'PUT', path: '/account/setForward', limit: 20, windowSeconds: 3600 },
	{ method: 'POST', path: '/setting/set', limit: 20, windowSeconds: 3600 },
	{ method: 'PUT', path: '/ai/system', limit: 20, windowSeconds: 3600 },
	{ method: 'POST', path: '/ai/monitors', limit: 20, windowSeconds: 3600 },
	{ method: 'PUT', path: '/ai/monitors/:id', pattern: /^\/ai\/monitors\/\d+$/, limit: 30, windowSeconds: 3600 },
	{ method: 'DELETE', path: '/ai/monitors/:id', pattern: /^\/ai\/monitors\/\d+$/, limit: 20, windowSeconds: 3600 },
	{ method: 'POST', path: '/ai/monitors/:id/preview-count', pattern: /^\/ai\/monitors\/\d+\/preview-count$/, limit: 60, windowSeconds: 3600 },
	{ method: 'POST', path: '/ai/digests/preview', limit: 6, windowSeconds: 3600 },
	{ method: 'POST', path: '/ai/digests/:id/deliver', pattern: /^\/ai\/digests\/\d+\/deliver$/, limit: 10, windowSeconds: 3600 },
	{ method: 'PUT', path: '/ai/digests/:id/retained', pattern: /^\/ai\/digests\/\d+\/retained$/, limit: 30, windowSeconds: 3600 },
	{ method: 'DELETE', path: '/ai/digests/:id', pattern: /^\/ai\/digests\/\d+$/, limit: 30, windowSeconds: 3600 }
];

async function hashPrincipal(value) {
	const bytes = new TextEncoder().encode(value.slice(0, 256));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

app.use('*', async (c, next) => {
	const rule = RULES.find(item => item.method === c.req.method && (item.path === c.req.path || item.pattern?.test(c.req.path)));
	if (!rule) return next();
	if (!c.env.kv) throw new BizError('Rate-limit storage is unavailable', 503);

	const user = c.get('user');
	const principal = user?.userId ? `user:${user.userId}` : `ip:${reqUtils.getIp(c)}`;
	const bucket = Math.floor(Date.now() / (rule.windowSeconds * 1000));
	const key = `security:rate:${rule.path}:${await hashPrincipal(principal)}:${bucket}`;
	const current = Number(await c.env.kv.get(key) || 0);

	if (current >= rule.limit) {
		const retryAfter = rule.windowSeconds - Math.floor((Date.now() / 1000) % rule.windowSeconds);
		c.header('Retry-After', String(retryAfter));
		throw new BizError('Too many requests', 429);
	}

	await c.env.kv.put(key, String(current + 1), { expirationTtl: rule.windowSeconds + 60 });
	return next();
});

export { RULES };
