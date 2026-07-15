import app from '../hono/hono';
import { dbInit } from '../init/init';
import BizError from '../error/biz-error';

app.post('/bootstrap', async (c) => {
	if (c.env.ENABLE_BOOTSTRAP !== 'true') {
		throw new BizError('Bootstrap is disabled', 404);
	}
	const provided = c.req.header('X-Bootstrap-Token');
	if (!provided || provided !== c.env.BOOTSTRAP_TOKEN) {
		throw new BizError('Bootstrap authorization failed', 401);
	}
	if (await c.env.kv.get('security:bootstrap:complete')) {
		throw new BizError('Bootstrap has already completed', 409);
	}
	const response = await dbInit.init(c);
	await c.env.kv.put('security:bootstrap:complete', new Date().toISOString());
	return response;
});
