import { describe, expect, it, vi } from 'vitest';
import { getAiConfig, isAiMonitorEnabled } from '../src/ai/ai-config';
import aiScheduler from '../src/ai/ai-scheduler';
import { checkAiBudget, estimateTokens } from '../src/ai/ai-budget';
import { normalizeEmailForAi } from '../src/ai/email-normalizer';
import { validateDigestOutput } from '../src/ai/ai-output-validator';
import WorkersAiProvider from '../src/ai/workers-ai-provider';
import { dbInit } from '../src/init/init';
import { assertAdminAiAccess, validateMonitorInput } from '../src/service/ai-monitor-service';
import { filterEmail } from '../src/service/ai-digest-service';

describe('AI monitoring foundation', () => {
	it('is strictly disabled unless explicitly enabled', async () => {
		expect(isAiMonitorEnabled({})).toBe(false);
		expect(isAiMonitorEnabled({ AI_MONITOR_ENABLED: true })).toBe(false);
		expect(isAiMonitorEnabled({ AI_MONITOR_ENABLED: 'TRUE' })).toBe(false);
		expect(isAiMonitorEnabled({ AI_MONITOR_ENABLED: 'true' })).toBe(true);

		const db = { prepare: vi.fn(() => { throw new Error('must not query D1'); }) };
		const ai = { run: vi.fn(() => { throw new Error('must not call AI'); }) };
		expect(await aiScheduler.run({ env: { db, ai } })).toEqual({ status: 'disabled' });
		expect(db.prepare).not.toHaveBeenCalled();
		expect(ai.run).not.toHaveBeenCalled();
	});

	it('applies bounded zero-cost defaults', () => {
		expect(getAiConfig({})).toMatchObject({
			enabled: false,
			maxDailyCalls: 4,
			maxDailyEstimatedNeurons: 7000,
			attachmentsEnabled: false,
			externalProvidersEnabled: false
		});
		expect(getAiConfig({ AI_MAX_DAILY_CALLS: '999' }).maxDailyCalls).toBe(48);
	});

	it('normalizes, truncates, and redacts untrusted email data', () => {
		const email = normalizeEmailForAi({
			email_id: 7,
			send_email: ' sender@example.com ',
			subject: 'password=hunter2',
			text: 'Authorization: Bearer abc.def.ghi\nCard 4111 1111 1111 1111\nCode 123456\nKeep this tail'
		}, 80);
		expect(email.emailId).toBe(7);
		expect(email.subject).not.toContain('hunter2');
		expect(email.body).not.toContain('abc.def.ghi');
		expect(email.body).not.toContain('4111 1111 1111 1111');
		expect(email.body.length).toBeLessThanOrEqual(80);
	});

	it('rejects prompt-injected, unsafe, or untraceable model output', () => {
		const valid = {
			title: '今日摘要', overview: '一封邮件需要处理。',
			items: [{ emailId: 7, priority: 'high', category: 'action_required', summary: '确认日期', actions: [{ text: '确认日期', dueAt: null, confidence: 'medium' }] }]
		};
		expect(validateDigestOutput(valid, [7])).toEqual(valid);
		expect(validateDigestOutput({response: valid}, [7])).toEqual(valid);
		expect(() => validateDigestOutput({ ...valid, items: [{ ...valid.items[0], emailId: 999 }] }, [7])).toThrow('emailId');
		expect(() => validateDigestOutput({ ...valid, overview: '<script>steal()</script>' }, [7])).toThrow('overview');
	});

	it('hard-stops a request that would cross any daily budget', () => {
		expect(estimateTokens(4001)).toBe(1001);
		const result = checkAiBudget({
			current: { calls: 3, inputTokens: 100, outputTokens: 10, estimatedNeurons: 6999 },
			requested: { inputTokens: 1000, outputTokens: 100 },
			limits: getAiConfig({})
		});
		expect(result.allowed).toBe(false);
		expect(result.reasonCode).toBe('daily_estimated_neurons');
	});

	it('keeps the provider tool-free and JSON-only', async () => {
		const run = vi.fn().mockResolvedValue({ response: '{}' });
		const provider = new WorkersAiProvider({ run });
		await provider.generateDigest({ systemPrompt: 'system', userPrompt: 'data' });
		expect(run).toHaveBeenCalledOnce();
		const [, request] = run.mock.calls[0];
		expect(request.response_format).toEqual({ type: 'json_object' });
		expect(request.tools).toBeUndefined();
	});

	it('keeps the AI schema migration repeatable', async () => {
		const statements = [];
		const db = { prepare: vi.fn(statement => ({ run: async () => { statements.push(statement); } })) };
		const context = { env: { db } };
		await dbInit.v3_3DB(context);
		await dbInit.v3_3DB(context);
		expect(statements.length).toBeGreaterThan(20);
		expect(statements.every(statement => /IF NOT EXISTS/i.test(statement))).toBe(true);
	});

	it('rejects ordinary users at the AI business boundary', () => {
		const context = { env: { admin: 'admin@echoec.com' }, get: () => ({ userId: 2, email: 'user@echoec.com' }) };
		expect(() => assertAdminAiAccess(context)).toThrow();
		try { assertAdminAiAccess(context); } catch (error) { expect(error.code).toBe(403); }
	});

	it('accepts only explicit mailbox mappings and bounded monitor limits', () => {
		const input = validateMonitorInput({name: ' Daily ', accountIds: [4, 4, 7], maxEmailsPerRun: 999, maxCharsPerEmail: 99999});
		expect(input).toMatchObject({name: 'Daily', accountIds: [4, 7], maxEmailsPerRun: 200, maxCharsPerEmail: 20000});
		expect(() => validateMonitorInput({name: 'Empty', accountIds: []})).toThrow();
	});

	it('filters configured senders without ever serializing attachments', () => {
		const monitor = {senderAllowlist: ['trusted.example'], senderBlocklist: [], subjectKeywords: ['invoice']};
		expect(filterEmail({send_email: 'billing@trusted.example', subject: 'Invoice 42'}, monitor)).toBe(true);
		expect(filterEmail({send_email: 'attacker@example.net', subject: 'Invoice 42'}, monitor)).toBe(false);
		const normalized = normalizeEmailForAi({email_id: 8, text: 'body', attachments: [{content: 'private-file'}]});
		expect(JSON.stringify(normalized)).not.toContain('private-file');
	});
});
