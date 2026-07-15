import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import emailHtmlTemplate from '../src/template/email-html';
import { normalizeForwardingTarget } from '../src/utils/forwarding-utils';
import settingService from '../src/service/setting-service';
import BizError from '../src/error/biz-error';
import { RULES as rateLimitRules } from '../src/security/rate-limit';

describe('production security baseline', () => {
	it('uses a client-error status for ordinary business validation failures', () => {
		const error = new BizError('validation failed');
		expect(error.code).toBe(400);
	});

	it('keeps public registration disabled unless explicitly enabled', async () => {
		const response = await SELF.fetch('https://cloudmail.echoec.com/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'attacker@echoec.com', password: 'test-password' })
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: 403 });
	});

	it('does not let an unauthenticated caller claim the configured admin address', async () => {
		const response = await SELF.fetch('https://cloudmail.echoec.com/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'admin@echoec.com', password: 'attacker-password' })
		});
		expect(response.status).toBe(403);
	});

	it('does not expose the legacy public batch API', async () => {
		const response = await SELF.fetch('https://cloudmail.echoec.com/api/public/addUser', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ list: [] })
		});
		expect(response.status).toBe(401);
	});

	it('requires authentication for every AI management API surface', async () => {
		const requests = [
			['GET', '/api/ai/monitors'],
			['GET', '/api/ai/accounts'],
			['GET', '/api/ai/system'],
			['PUT', '/api/ai/system'],
			['POST', '/api/ai/monitors'],
			['PUT', '/api/ai/monitors/1'],
			['DELETE', '/api/ai/monitors/1'],
			['POST', '/api/ai/monitors/1/preview-count'],
			['GET', '/api/ai/digests'],
			['GET', '/api/ai/runs'],
			['GET', '/api/ai/digests/1'],
			['GET', '/api/ai/digests/1/source/1'],
			['GET', '/api/ai/usage/today'],
			['GET', '/api/ai/metrics'],
			['POST', '/api/ai/digests/preview'],
			['POST', '/api/ai/digests/1/deliver'],
			['PUT', '/api/ai/digests/1/retained'],
			['DELETE', '/api/ai/digests/1']
		];
		for (const [method, path] of requests) {
			const response = await SELF.fetch(`https://cloudmail.echoec.com${path}`, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: ['POST', 'PUT'].includes(method) ? '{}' : undefined
			});
			expect(response.status, `${method} ${path}`).toBe(401);
		}
	});

	it('does not treat lookalike authentication paths as public', async () => {
		const response = await SELF.fetch('https://cloudmail.echoec.com/api/login-attacker');
		expect(response.status).toBe(401);
	});

	it('rate-limits every AI mutation and preview endpoint', () => {
		const guarded = new Set(rateLimitRules.filter(rule => rule.path.startsWith('/ai/')).map(rule => `${rule.method} ${rule.path}`));
		expect(guarded).toEqual(new Set([
			'PUT /ai/system',
			'POST /ai/monitors',
			'PUT /ai/monitors/:id',
			'DELETE /ai/monitors/:id',
			'POST /ai/monitors/:id/preview-count',
			'POST /ai/digests/preview',
			'POST /ai/digests/:id/deliver',
			'PUT /ai/digests/:id/retained',
			'DELETE /ai/digests/:id'
		]));
	});

	it('reapplies runtime secrets when settings are already cached in the request', async () => {
		const context = {
			env: {
				domain: ['echoec.com'],
				TURNSTILE_SECRET_KEY: 'runtime-only-secret'
			},
			get: () => ({ emailPrefixFilter: '' }),
			set: () => {}
		};
		const configured = await settingService.query(context);
		expect(configured.secretKey).toBe('runtime-only-secret');
		expect(configured.domainList).toEqual(['@echoec.com']);
	});

	it('renders Telegram previews inside a scriptless opaque sandbox', () => {
		const rendered = emailHtmlTemplate('<img src=x onerror="parent.postMessage(document.cookie,\'*\')"><script>alert(1)</script>');
		expect(rendered).toContain('sandbox=""');
		expect(rendered).toContain("default-src 'none'");
		expect(rendered).not.toContain('attachShadow');
		expect(rendered).not.toContain('<script>alert(1)</script>');
	});

	it('normalizes an external forwarding target and blocks loops', () => {
		expect(normalizeForwardingTarget({
			sourceEmail: 'sales@echoec.com',
			targetEmail: '  User@Example.net ',
			managedDomains: ['echoec.com'],
			enabled: true
		})).toBe('user@example.net');
		expect(() => normalizeForwardingTarget({
			sourceEmail: 'sales@echoec.com',
			targetEmail: 'loop@echoec.com',
			managedDomains: ['echoec.com'],
			enabled: true
		})).toThrow('managed domain');
	});
});
