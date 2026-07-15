import app from '../hono/hono';
import result from '../model/result';
import aiMonitorService from '../service/ai-monitor-service';

app.get('/ai/monitors', async c => c.json(result.ok(await aiMonitorService.list(c))));
app.get('/ai/accounts', async c => c.json(result.ok(await aiMonitorService.accounts(c))));
app.get('/ai/system', async c => c.json(result.ok(await aiMonitorService.systemState(c))));
app.put('/ai/system', async c => c.json(result.ok(await aiMonitorService.updateSystemState(c, await c.req.json()))));
app.post('/ai/monitors', async c => c.json(result.ok(await aiMonitorService.create(c, await c.req.json()))));
app.put('/ai/monitors/:id', async c => c.json(result.ok(await aiMonitorService.update(c, c.req.param('id'), await c.req.json()))));
app.delete('/ai/monitors/:id', async c => {
	await aiMonitorService.remove(c, c.req.param('id'));
	return c.json(result.ok());
});
