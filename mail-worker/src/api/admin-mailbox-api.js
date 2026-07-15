import app from '../hono/hono';
import result from '../model/result';
import adminMailboxService from '../service/admin-mailbox-service';

app.get('/adminMailbox/users', async c => c.json(result.ok(await adminMailboxService.users(c))));
app.get('/adminMailbox/accounts', async c => c.json(result.ok(await adminMailboxService.accounts(c, c.req.query()))));
app.get('/adminMailbox/list', async c => c.json(result.ok(await adminMailboxService.list(c, c.req.query()))));
app.get('/adminMailbox/latest', async c => c.json(result.ok(await adminMailboxService.latest(c, c.req.query()))));
app.put('/adminMailbox/setAllReceive', async c => {
	await adminMailboxService.setAllReceive(c, await c.req.json());
	return c.json(result.ok());
});
app.put('/adminMailbox/setName', async c => {
	await adminMailboxService.setName(c, await c.req.json());
	return c.json(result.ok());
});
app.put('/adminMailbox/setForward', async c => {
	await adminMailboxService.setForward(c, await c.req.json());
	return c.json(result.ok());
});
