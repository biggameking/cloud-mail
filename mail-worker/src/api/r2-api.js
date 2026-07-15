import r2Service from '../service/r2-service';
import app from '../hono/hono';
import attService from '../service/att-service';
import BizError from '../error/biz-error';

app.get('/oss/*', async (c) => {
	const key = c.req.path.split('/oss/')[1];
	const user = c.get('user');
	const attachment = user.email === c.env.admin
		? await attService.selectByKey(c, key)
		: await attService.selectOwnedByKey(c, key, user.userId);
	if (!attachment) throw new BizError('Attachment not found', 404);
	const obj = await r2Service.getObj(c, key);
	if (!obj) throw new BizError('Attachment not found', 404);
	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
			'Content-Disposition': obj.httpMetadata?.contentDisposition || 'attachment',
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
});


