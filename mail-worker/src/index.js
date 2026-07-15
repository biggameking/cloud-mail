import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		if (url.pathname.startsWith('/static/')) {
			const staticResponse = await kvObjService.toObjResp({ env }, url.pathname.substring(1));
			if (!staticResponse) return new Response('Not found', { status: 404 });
			const headers = new Headers(staticResponse.headers);
			headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
			headers.set('X-Content-Type-Options', 'nosniff');
			headers.set('Cross-Origin-Resource-Policy', 'same-origin');
			return new Response(staticResponse.body, { status: staticResponse.status, headers });
		}

		const assetResponse = await env.assets.fetch(req);
		const headers = new Headers(assetResponse.headers);
		headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
		headers.set('X-Content-Type-Options', 'nosniff');
		headers.set('Referrer-Policy', 'no-referrer');
		headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
		return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await oauthService.clearNoBindOathUser({ env })
		await analysisService.refreshEchartsCache({ env })
	},
};
