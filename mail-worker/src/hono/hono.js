import { Hono } from 'hono';
const app = new Hono();

import result from '../model/result';
import { cors } from 'hono/cors';

app.use('*', cors({
	origin: (origin, c) => {
		if (!origin) return null;
		const configured = c.env.ALLOWED_ORIGINS || '';
		const allowedOrigins = configured.split(',').map(item => item.trim()).filter(Boolean);
		return allowedOrigins.includes(origin) ? origin : null;
	},
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
	credentials: true,
	maxAge: 86400
}));

app.use('*', async (c, next) => {
	await next();
	c.header('X-Content-Type-Options', 'nosniff');
	c.header('Referrer-Policy', 'no-referrer');
	c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	c.header('X-Frame-Options', 'DENY');
});

app.onError((err, c) => {
	if (err.message === `Cannot read properties of undefined (reading 'get')`) {
		return c.json(result.fail('KV数据库未绑定 KV database not bound',502));
	}

	if (err.message === `Cannot read properties of undefined (reading 'put')`) {
		return c.json(result.fail('KV数据库未绑定 KV database not bound',502));
	}

	if (err.message === `Cannot read properties of undefined (reading 'prepare')`) {
		return c.json(result.fail('D1数据库未绑定 D1 database not bound',502));
	}

	if (err.name === 'BizError') {
		const status = Number.isInteger(err.code) && err.code >= 400 && err.code <= 599 ? err.code : 400;
		return c.json(result.fail(err.message, status), status);
	}

	const requestId = c.req.header('X-Request-Id') || crypto.randomUUID();
	console.error('Unhandled request error', { requestId, name: err?.name || 'Error' });
	c.header('X-Request-Id', requestId);
	return c.json(result.fail('Internal server error', 500), 500);
});

export default app;


