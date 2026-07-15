import app from '../hono/hono';
import result from '../model/result';
import aiDigestService from '../service/ai-digest-service';
import aiDeliveryService from '../service/ai-delivery-service';

app.get('/ai/digests', async c => c.json(result.ok(await aiDigestService.list(c))));
app.get('/ai/runs', async c => c.json(result.ok(await aiDigestService.runs(c))));
app.get('/ai/digests/:id', async c => c.json(result.ok(await aiDigestService.detail(c, c.req.param('id')))));
app.get('/ai/digests/:id/source/:emailId', async c => c.json(result.ok(await aiDigestService.source(c, c.req.param('id'), c.req.param('emailId')))));
app.get('/ai/usage/today', async c => c.json(result.ok(await aiDigestService.usageToday(c))));
app.post('/ai/digests/preview', async c => c.json(result.ok(await aiDigestService.preview(c, await c.req.json()))));
app.post('/ai/digests/:id/deliver', async c => c.json(result.ok(await aiDeliveryService.request(c, c.req.param('id')))));
app.put('/ai/digests/:id/retained', async c => {
	await aiDigestService.setRetained(c, c.req.param('id'), (await c.req.json()).retained);
	return c.json(result.ok());
});
app.delete('/ai/digests/:id', async c => {
	await aiDigestService.remove(c, c.req.param('id'));
	return c.json(result.ok());
});
