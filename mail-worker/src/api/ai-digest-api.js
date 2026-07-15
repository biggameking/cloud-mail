import app from '../hono/hono';
import result from '../model/result';
import aiDigestService from '../service/ai-digest-service';

app.get('/ai/digests', async c => c.json(result.ok(await aiDigestService.list(c))));
app.get('/ai/digests/:id', async c => c.json(result.ok(await aiDigestService.detail(c, c.req.param('id')))));
app.get('/ai/digests/:id/source/:emailId', async c => c.json(result.ok(await aiDigestService.source(c, c.req.param('id'), c.req.param('emailId')))));
app.get('/ai/usage/today', async c => c.json(result.ok(await aiDigestService.usageToday(c))));
app.post('/ai/digests/preview', async c => c.json(result.ok(await aiDigestService.preview(c, await c.req.json()))));
