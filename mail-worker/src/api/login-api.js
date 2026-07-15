import app from '../hono/hono';
import loginService from '../service/login-service';
import result from '../model/result';
import userContext from '../security/user-context';
import BizError from '../error/biz-error';

app.post('/login', async (c) => {
	const token = await loginService.login(c, await c.req.json());
	return c.json(result.ok({ token: token }));
});

app.post('/register', async (c) => {
	const params = await c.req.json();
	const isAdminEmail = params.email?.toLowerCase() === c.env.admin?.toLowerCase();
	const bootstrapToken = c.req.header('X-Bootstrap-Token');
	const isBootstrapAdmin = isAdminEmail
		&& c.env.ENABLE_BOOTSTRAP === 'true'
		&& Boolean(bootstrapToken)
		&& bootstrapToken === c.env.BOOTSTRAP_TOKEN
		&& !await c.env.kv.get('security:admin-registration:complete');

	if (c.env.ALLOW_PUBLIC_REGISTRATION !== 'true' && !isBootstrapAdmin) {
		throw new BizError('Public registration is disabled', 403);
	}
	const jwt = await loginService.register(c, params, false, isBootstrapAdmin);
	if (isBootstrapAdmin) {
		await c.env.kv.put('security:admin-registration:complete', new Date().toISOString());
	}
	return c.json(result.ok(jwt));
});

app.delete('/logout', async (c) => {
	await loginService.logout(c, userContext.getUserId(c));
	return c.json(result.ok());
});

