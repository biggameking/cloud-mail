import { describe, expect, it } from 'vitest';
import { SELF } from 'cloudflare:test';
import BizError from '../src/error/biz-error';
import {
	assertAdminMailboxAccess,
	resolveAdminMailboxScope
} from '../src/service/admin-mailbox-service';

describe('super-admin mailbox scope', () => {
	it('does not expose admin mailbox APIs without authentication', async () => {
		const response = await SELF.fetch('https://cloudmail.echoec.com/api/adminMailbox/users');
		expect(response.status).toBe(401);
	});

	it('does not expose admin mailbox mutation APIs without authentication', async () => {
		const response = await SELF.fetch('https://cloudmail.echoec.com/api/adminMailbox/setAllReceive', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accountId: 3 })
		});
		expect(response.status).toBe(401);
	});

	it('allows only the configured super-admin identity', () => {
		expect(() => assertAdminMailboxAccess(
			{ email: 'admin@echoec.com' },
			'admin@echoec.com'
		)).not.toThrow();
		expect(() => assertAdminMailboxAccess(
			{ email: 'pixelboard@echoec.com' },
			'admin@echoec.com'
		)).toThrowError(BizError);
	});

	it('keeps aggregate inbox disabled by default', () => {
		expect(() => resolveAdminMailboxScope({ scope: 'aggregate' }, 1))
			.toThrowError(BizError);
		expect(resolveAdminMailboxScope({ scope: 'aggregate' }, 0))
			.toEqual({ aggregate: true, userId: 0 });
	});

	it('requires an explicit positive user id for user mailbox views', () => {
		expect(resolveAdminMailboxScope({ scope: 'user', userId: '2' }, 1))
			.toEqual({ aggregate: false, userId: 2 });
		expect(() => resolveAdminMailboxScope({ scope: 'user', userId: '0' }, 1))
			.toThrowError(BizError);
	});
});
