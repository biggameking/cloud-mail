import { describe, expect, it, vi } from 'vitest';
import { getAiConfig, isAiMonitorEnabled } from '../src/ai/ai-config';
import aiScheduler from '../src/ai/ai-scheduler';
import { checkAiBudget, estimateTokens } from '../src/ai/ai-budget';
import { normalizeEmailForAi } from '../src/ai/email-normalizer';
import { validateDigestOutput } from '../src/ai/ai-output-validator';
import WorkersAiProvider from '../src/ai/workers-ai-provider';
import { dbInit } from '../src/init/init';
import aiMonitorService, { assertAdminAiAccess, parseMonitorRow, validateMonitorInput } from '../src/service/ai-monitor-service';
import { filterEmail } from '../src/service/ai-digest-service';
import aiDeliveryService, { escapeHtml, renderDigestEmail } from '../src/service/ai-delivery-service';
import aiDigestService from '../src/service/ai-digest-service';
import aiSchedulerService from '../src/service/ai-scheduler-service';
import aiRetentionService from '../src/service/ai-retention-service';
import { localDateKey, nextDailyRun } from '../src/ai/ai-schedule';
import aiSafetyEmails from '../test-fixtures/ai-safety-emails';
import { buildDigestPrompt, PROMPT_VERSION } from '../src/ai/ai-prompt';

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

	it('requires Simplified Chinese output independently of source language', () => {
		const prompt = buildDigestPrompt({
			language: 'zh-CN',
			emails: [{ emailId: 7, subject: 'English subject', body: 'Please review the report.' }]
		});
		expect(PROMPT_VERSION).toBe('digest-v2-zh');
		expect(prompt).toContain('输出语言必须为简体中文');
		expect(prompt).toContain('即使原邮件是英文');
		expect(prompt).toContain('"allowedEmailIds":[7]');
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

	it('keeps phase-three migrations repeatable when columns already exist', async () => {
		const statements = [];
		const db = { prepare: vi.fn(statement => ({ run: async () => {
			statements.push(statement);
			if (/ALTER TABLE/i.test(statement)) throw new Error('duplicate column name');
		} })) };
		await dbInit.v3_4DB({ env: { db } });
		await dbInit.v3_4DB({ env: { db } });
		expect(statements.filter(statement => /CREATE TABLE IF NOT EXISTS ai_system_config/i.test(statement))).toHaveLength(2);
		expect(statements.filter(statement => /ALTER TABLE/i.test(statement))).toHaveLength(10);
	});

	it('requires both environment and database switches before scheduling', async () => {
		const ai = { run: vi.fn() };
		const db = { prepare: vi.fn(() => ({ first: async () => ({ enabled: 0, delivery_enabled: 0 }) })) };
		expect(await aiScheduler.run({ env: { db, ai, AI_MONITOR_ENABLED: 'true' }, cron: '*/30 * * * *' })).toEqual({ status: 'stopped' });
		expect(ai.run).not.toHaveBeenCalled();
	});

	it('keeps 48 empty half-hour schedules bounded and model-free', async () => {
		const statements = [];
		const ai = { run: vi.fn() };
		const db = { prepare: vi.fn(sql => {
			statements.push(sql);
			return {
				bind() { return this; },
				first: async () => ({ enabled: 1, delivery_enabled: 0 }),
				all: async () => ({ results: [] })
			};
		}) };
		for (let halfHour = 0; halfHour < 48; halfHour += 1) {
			expect(await aiScheduler.run({ env: { db, ai, AI_MONITOR_ENABLED: 'true' }, cron: '*/30 * * * *' }))
				.toMatchObject({ status: 'completed', outcomes: [] });
		}
		expect(ai.run).not.toHaveBeenCalled();
		expect(statements).toHaveLength(96);
		expect(statements.every(sql => /ai_system_config|ai_monitor/i.test(sql))).toBe(true);
	});

	it('logs only a safe error class when the scheduler fails', async () => {
		const schedulerRun = vi.spyOn(aiSchedulerService, 'run').mockRejectedValue(new Error('private subject and secret body'));
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await aiScheduler.run({ env: { AI_MONITOR_ENABLED: 'true' }, cron: '*/30 * * * *' })).toEqual({ status: 'failed' });
		const serializedLogs = JSON.stringify(consoleError.mock.calls);
		expect(serializedLogs).toContain('errorClass');
		expect(serializedLogs).not.toContain('private subject');
		expect(serializedLogs).not.toContain('secret body');
		schedulerRun.mockRestore();
		consoleError.mockRestore();
	});

	it('never retries or sends digest email while the delivery switch is off', async () => {
		const context = {
			env: {
				AI_MONITOR_ENABLED: 'true',
				db: { prepare: vi.fn(() => ({ bind() { return this; }, run: async () => ({ meta: { changes: 1 } }) })) }
			}
		};
		const systemState = vi.spyOn(aiMonitorService, 'systemState').mockResolvedValue({ enabled: true, deliveryEnabled: false });
		const dueMonitors = vi.spyOn(aiSchedulerService, 'dueMonitors').mockResolvedValue([{
			monitorId: 7,
			timezone: 'Asia/Shanghai',
			scheduleTime: '08:00'
		}]);
		const generate = vi.spyOn(aiDigestService, 'generate').mockResolvedValue({ status: 'succeeded', digestId: 9 });
		const retryPending = vi.spyOn(aiDeliveryService, 'retryPending').mockResolvedValue([{ status: 'sent' }]);
		const deliver = vi.spyOn(aiDeliveryService, 'deliver').mockResolvedValue({ status: 'sent' });

		const result = await aiSchedulerService.run(context, new Date('2026-07-15T00:30:00.000Z'));

		expect(result).toMatchObject({ status: 'completed', deliveries: [] });
		expect(generate).toHaveBeenCalledWith(context, expect.any(Object), expect.objectContaining({ deliveryRequested: false }));
		expect(retryPending).not.toHaveBeenCalled();
		expect(deliver).not.toHaveBeenCalled();
		systemState.mockRestore();
		dueMonitors.mockRestore();
		generate.mockRestore();
		retryPending.mockRestore();
		deliver.mockRestore();
	});

	it('keeps automatic delivery disabled for a rule unless it explicitly opts in', async () => {
		const context = {
			env: {
				AI_MONITOR_ENABLED: 'true',
				db: { prepare: vi.fn(() => ({ bind() { return this; }, run: async () => ({ meta: { changes: 1 } }) })) }
			}
		};
		const systemState = vi.spyOn(aiMonitorService, 'systemState').mockResolvedValue({ enabled: true, deliveryEnabled: true });
		const retryPending = vi.spyOn(aiDeliveryService, 'retryPending').mockResolvedValue([]);
		const dueMonitors = vi.spyOn(aiSchedulerService, 'dueMonitors').mockResolvedValue([{
			monitorId: 7,
			timezone: 'Asia/Shanghai',
			scheduleTime: '08:00',
			deliveryEnabled: false
		}]);
		const generate = vi.spyOn(aiDigestService, 'generate').mockResolvedValue({ status: 'succeeded', digestId: 9 });
		const deliver = vi.spyOn(aiDeliveryService, 'deliver').mockResolvedValue({ status: 'sent' });

		await aiSchedulerService.run(context, new Date('2026-07-15T00:30:00.000Z'));

		expect(retryPending).toHaveBeenCalledOnce();
		expect(generate).toHaveBeenCalledWith(context, expect.any(Object), expect.objectContaining({ deliveryRequested: false }));
		expect(deliver).not.toHaveBeenCalled();
		systemState.mockRestore();
		retryPending.mockRestore();
		dueMonitors.mockRestore();
		generate.mockRestore();
		deliver.mockRestore();
	});

	it('rejects explicit digest delivery while the delivery switch is off', async () => {
		const systemState = vi.spyOn(aiMonitorService, 'systemState').mockResolvedValue({
			environmentEnabled: true,
			enabled: true,
			deliveryEnabled: false
		});
		const send = vi.fn();
		const context = {
			env: { admin: 'admin@example.com', ai_digest_email: { send }, AI_DIGEST_DESTINATION_SECRET: 'verified@example.com' },
			get: () => ({ userId: 1, email: 'admin@example.com' })
		};

		await expect(aiDeliveryService.request(context, 3)).rejects.toMatchObject({ code: 409 });
		expect(send).not.toHaveBeenCalled();
		systemState.mockRestore();
	});

	it('delivers an existing digest only to the configured destination', async () => {
		const systemState = vi.spyOn(aiMonitorService, 'systemState').mockResolvedValue({
			environmentEnabled: true,
			enabled: true,
			deliveryEnabled: true
		});
		const statements = [];
		const db = { prepare: vi.fn(sql => {
			statements.push(sql);
			return {
				bind() { return this; },
				run: async () => ({ meta: { changes: 1 } }),
				first: async () => sql.includes('delivery_status, delivery_attempts')
					? { delivery_status: 'not_requested', delivery_attempts: 0 }
					: { digest_id: 3, title: 'Digest', overview: 'Overview', content_json: '{"items":[]}' }
			};
		}) };
		const send = vi.fn().mockResolvedValue(undefined);
		const context = {
			env: {
				admin: 'admin@example.com', db, ai_digest_email: { send },
				AI_DIGEST_DESTINATION_SECRET: 'verified@example.com'
			},
			get: () => ({ userId: 1, email: 'admin@example.com' })
		};

		expect(await aiDeliveryService.request(context, 3)).toEqual({ status: 'sent' });
		expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'verified@example.com' }));
		expect(statements.some(sql => /delivery_status = 'pending'/i.test(sql))).toBe(true);
		expect(statements.some(sql => /delivery_status = 'sent'/i.test(sql))).toBe(true);
		systemState.mockRestore();
	});

	it('retries only digests whose enabled rule opted into the verified destination', async () => {
		const statements = [];
		const bindings = [];
		const db = {prepare: vi.fn(sql => ({
			bind(...values) { statements.push(sql); bindings.push(values); return this; },
			all: async () => ({results: []})
		}))};
		expect(await aiDeliveryService.retryPending({env: {
			db, ai_digest_email: {send: vi.fn()}, AI_DIGEST_DESTINATION_SECRET: 'verified@example.com'
		}})).toEqual([]);
		expect(statements[0]).toMatch(/JOIN ai_monitor/i);
		expect(statements[0]).toMatch(/m\.enabled = 1/i);
		expect(statements[0]).toMatch(/m\.destination_key = \?/i);
		expect(bindings[0]).toEqual(['verified-destination']);
	});

	it('refuses to enable the database switch while the environment kill switch is off', async () => {
		const context = {
			env: { admin: 'admin@echoec.com', AI_MONITOR_ENABLED: 'false', db: { prepare: vi.fn() } },
			get: () => ({ userId: 1, email: 'admin@echoec.com' })
		};
		await expect(aiMonitorService.updateSystemState(context, { enabled: true })).rejects.toMatchObject({ code: 409 });
		expect(context.env.db.prepare).not.toHaveBeenCalled();
	});

	it('retention never selects permanently retained digests', async () => {
		const statements = [];
		const db = {
			prepare: vi.fn(statement => {
				statements.push(statement);
				return { all: async () => ({ results: [] }) };
			}),
			batch: vi.fn().mockResolvedValue([])
		};
		expect(await aiRetentionService.cleanup({ env: { db, AI_MONITOR_ENABLED: 'true' } })).toEqual({ status: 'completed', deletedDigests: 0 });
		expect(statements.some(statement => /WHERE retained = 0/i.test(statement))).toBe(true);
	});

	it('rejects ordinary users at the AI business boundary', () => {
		const context = { env: { admin: 'admin@echoec.com' }, get: () => ({ userId: 2, email: 'user@echoec.com' }) };
		expect(() => assertAdminAiAccess(context)).toThrow();
		try { assertAdminAiAccess(context); } catch (error) { expect(error.code).toBe(403); }
	});

	it('rejects ordinary users across every AI management service before database access', async () => {
		const db = { prepare: vi.fn(() => { throw new Error('database must not be reached'); }) };
		const context = {
			env: { admin: 'admin@echoec.com', db },
			get: () => ({ userId: 2, email: 'user@echoec.com' })
		};
		const calls = [
			() => aiMonitorService.systemState(context),
			() => aiMonitorService.accounts(context),
			() => aiMonitorService.list(context),
			() => aiMonitorService.create(context, {}),
			() => aiMonitorService.update(context, 1, {}),
			() => aiMonitorService.remove(context, 1),
			() => aiDigestService.usageToday(context),
			() => aiDigestService.previewCount(context, 1),
			() => aiDigestService.list(context),
			() => aiDigestService.runs(context),
			() => aiDigestService.detail(context, 1),
			() => aiDigestService.source(context, 1, 1),
			() => aiDigestService.preview(context, { monitorId: 1 }),
			() => aiDigestService.setRetained(context, 1, true),
			() => aiDigestService.remove(context, 1),
			() => aiDeliveryService.request(context, 1)
		];
		for (const call of calls) await expect(call()).rejects.toMatchObject({ code: 403 });
		expect(db.prepare).not.toHaveBeenCalled();
	});

	it('accepts only explicit mailbox mappings and bounded monitor limits', () => {
		const input = validateMonitorInput({name: ' Daily ', accountIds: [4, 4, 7], maxEmailsPerRun: 999, maxCharsPerEmail: 99999, categoryFilter: ['finance', 'finance']});
		expect(input).toMatchObject({name: 'Daily', accountIds: [4, 7], scheduleTime: '08:00', timezone: 'Asia/Shanghai', language: 'zh-CN', deliveryEnabled: false, maxEmailsPerRun: 200, maxCharsPerEmail: 20000, categoryFilter: ['finance']});
		expect(() => validateMonitorInput({name: 'Bad category', accountIds: [4], categoryFilter: ['execute_mail_command']})).toThrow();
		expect(() => validateMonitorInput({name: 'Bad time', accountIds: [4], scheduleTime: '08:15'})).toThrow();
		expect(() => validateMonitorInput({name: 'Bad timezone', accountIds: [4], timezone: 'Mars/Olympus'})).toThrow();
		expect(() => validateMonitorInput({name: 'Bad language', accountIds: [4], language: 'xx-ZZ'})).toThrow();
		expect(() => validateMonitorInput({name: 'Empty', accountIds: []})).toThrow();
	});

	it('exposes only a boolean rule delivery preference, never a destination address', () => {
		const monitor = parseMonitorRow({
			monitor_id: 1, owner_user_id: 1, name: 'Daily', enabled: 1, schedule_type: 'daily',
			schedule_time: '08:00', timezone: 'Asia/Shanghai', language: 'zh-CN', destination_key: 'verified-destination',
			include_read: 1, sender_allowlist: '[]', sender_blocklist: '[]', subject_keywords: '[]', category_filter: '[]',
			max_emails_per_run: 50, max_chars_per_email: 6000, last_processed_email_id: 0
		});
		expect(monitor.deliveryEnabled).toBe(true);
		expect(monitor).not.toHaveProperty('destinationKey');
		expect(JSON.stringify(monitor)).not.toContain('@');
	});

	it('persists schedule, language, and rule delivery with an exact D1 binding contract', async () => {
		const prepared = [];
		const db = {
			prepare: vi.fn(sql => ({
				bind(...values) {
					expect((sql.match(/\?/g) || []).length).toBe(values.length);
					prepared.push({sql, values});
					return this;
				},
				run: async () => ({meta: {last_row_id: 3}})
			})),
			batch: vi.fn().mockResolvedValue([])
		};
		const validateAccounts = vi.spyOn(aiMonitorService, 'validateAccounts').mockResolvedValue(undefined);
		const getMonitor = vi.spyOn(aiMonitorService, 'get').mockResolvedValue({monitorId: 3});
		const context = {env: {admin: 'admin@echoec.com', db}, get: () => ({userId: 1, email: 'admin@echoec.com'})};

		await aiMonitorService.create(context, {
			name: 'UTC digest', enabled: true, accountIds: [4], scheduleTime: '12:30', timezone: 'UTC',
			language: 'en-US', deliveryEnabled: true
		});

		const insert = prepared.find(item => /INSERT INTO ai_monitor/i.test(item.sql));
		expect(insert.values).toEqual(expect.arrayContaining(['12:30', 'UTC', 'en-US', 'verified-destination']));
		expect(db.batch).toHaveBeenCalledOnce();
		validateAccounts.mockRestore();
		getMonitor.mockRestore();
	});

	it('soft-deletes a monitoring rule without deleting its historical digests', async () => {
		const statements = [];
		const batch = vi.fn(async items => items);
		const db = {prepare: vi.fn(sql => {
			statements.push(sql);
			return {
				bind() { return this; },
				first: async () => sql.includes('SELECT * FROM ai_monitor') ? {
					monitor_id: 1, owner_user_id: 1, name: 'Daily', enabled: 1, is_deleted: 0,
					schedule_type: 'daily', schedule_time: '08:00', timezone: 'Asia/Shanghai', language: 'zh-CN',
					destination_key: '', include_read: 1, sender_allowlist: '[]', sender_blocklist: '[]',
					subject_keywords: '[]', category_filter: '[]', max_emails_per_run: 50, max_chars_per_email: 6000,
					last_processed_email_id: 0
				} : null,
				all: async () => ({results: []})
			};
		}), batch};
		const context = {env: {admin: 'admin@echoec.com', db}, get: () => ({email: 'admin@echoec.com'})};
		await aiMonitorService.remove(context, 1);
		expect(batch).toHaveBeenCalledOnce();
		expect(statements.some(sql => /UPDATE ai_monitor SET enabled = 0, is_deleted = 1/i.test(sql))).toBe(true);
		expect(statements.some(sql => /DELETE FROM ai_monitor WHERE/i.test(sql))).toBe(false);
		expect(statements.some(sql => /DELETE FROM ai_digest/i.test(sql))).toBe(false);
	});

	it('previews eligible counts without calling the model or serializing message content', async () => {
		const monitor = {monitorId: 1, accountIds: [4], includeRead: true, maxEmailsPerRun: 1, maxCharsPerEmail: 6000,
			lastProcessedEmailId: 0, senderAllowlist: [], senderBlocklist: [], subjectKeywords: []};
		const getMonitor = vi.spyOn(aiMonitorService, 'get').mockResolvedValue(monitor);
		const db = {prepare: vi.fn(() => ({
			bind() { return this; },
			all: async () => ({results: [
				{email_id: 1, send_email: 'one@example.com', subject: 'One', text: 'private one'},
				{email_id: 2, send_email: 'two@example.com', subject: 'Two', text: 'private two'}
			]})
		}))};
		const context = {env: {admin: 'admin@echoec.com', db, ai: {run: vi.fn()}}, get: () => ({email: 'admin@echoec.com'})};
		const result = await aiDigestService.previewCount(context, 1);
		expect(result).toEqual({eligibleCount: 2, willProcessCount: 1, filteredCount: 0, backlogCount: 1, scanLimitReached: false});
		expect(context.env.ai.run).not.toHaveBeenCalled();
		expect(JSON.stringify(result)).not.toContain('private');
		getMonitor.mockRestore();
	});

	it('rechecks active mailbox and user state before exposing historical digest sources', async () => {
		const statements = [];
		const db = {prepare: vi.fn(sql => {
			statements.push(sql);
			return {
				bind() { return this; },
				first: async () => sql.includes('FROM ai_digest d') ? {
					digest_id: 1, monitor_id: 1, monitor_name: 'Daily', title: 'Digest', overview: 'Overview',
					important_count: 0, action_count: 0, run_status: 'succeeded', backlog_count: 0,
					delivery_status: 'not_requested', delivery_attempts: 0, retained: 0, created_at: '2026-07-15 00:00:00'
				} : null,
				all: async () => ({results: []})
			};
		})};
		const context = {env: {admin: 'admin@echoec.com', db}, get: () => ({email: 'admin@echoec.com'})};
		const detail = await aiDigestService.detail(context, 1);
		expect(detail.items).toEqual([]);
		const sourceQuery = statements.find(sql => /FROM ai_digest_source s/i.test(sql));
		expect(sourceQuery).toMatch(/JOIN account a/i);
		expect(sourceQuery).toMatch(/JOIN user u/i);
		expect(sourceQuery).toMatch(/a\.is_del = 0/i);
		expect(sourceQuery).toMatch(/u\.status = 0/i);
	});

	it('filters configured senders without ever serializing attachments', () => {
		const monitor = {senderAllowlist: ['trusted.example'], senderBlocklist: [], subjectKeywords: ['invoice']};
		expect(filterEmail({send_email: 'billing@trusted.example', subject: 'Invoice 42'}, monitor)).toBe(true);
		expect(filterEmail({send_email: 'attacker@example.net', subject: 'Invoice 42'}, monitor)).toBe(false);
		const normalized = normalizeEmailForAi({email_id: 8, text: 'body', attachments: [{content: 'private-file'}]});
		expect(JSON.stringify(normalized)).not.toContain('private-file');
	});

	it('uses stable Shanghai daily windows and schedules the next run', () => {
		const now = new Date('2026-07-15T00:30:00.000Z');
		expect(localDateKey(now, 'Asia/Shanghai')).toBe('2026-07-15');
		expect(nextDailyRun('08:00', 'Asia/Shanghai', now)).toBe('2026-07-16T00:00:00.000Z');
	});

	it('escapes all model text in the outbound digest', () => {
		expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
		const rendered = renderDigestEmail({
			title: '<img src=x>', overview: 'safe',
			content_json: JSON.stringify({items: [{priority: 'high', category: 'other', summary: '<script>x</script>', actions: []}]})
		});
		expect(rendered.html).not.toContain('<script>');
		expect(rendered.html).not.toContain('<img src=x>');
	});

	it('claims a scheduled window before inference and skips duplicates', async () => {
		const ai = {run: vi.fn()};
		const db = {prepare: vi.fn(() => ({bind() { return this; }, run: async () => { throw new Error('UNIQUE constraint failed: ai_digest_run.monitor_id'); }}))};
		const outcome = await (await import('../src/service/ai-digest-service')).default.generate({env: {db, ai, AI_MONITOR_ENABLED: 'true'}}, {
			monitorId: 1, accountIds: [1]
		}, {periodStart: '2026-07-15', periodEnd: '2026-07-15:08:00', useCursor: true});
		expect(outcome.status).toBe('duplicate');
		expect(ai.run).not.toHaveBeenCalled();
	});

	it('does not advance the cursor when model inference fails', async () => {
		const statements = [];
		const db = {prepare: vi.fn(sql => {
			statements.push(sql);
			return {
				bind() { return this; },
				run: async () => ({meta: {last_row_id: 9, changes: 1}}),
				all: async () => ({results: [{email_id: 11, send_email: 'sender@example.com', subject: 'Subject', text: 'Body', create_time: '2026-07-15 08:00:00'}]}),
				first: async () => null
			};
		})};
		const monitor = {monitorId: 1, accountIds: [1], includeRead: true, maxEmailsPerRun: 50, maxCharsPerEmail: 6000,
			lastProcessedEmailId: 0, language: 'zh-CN', senderAllowlist: [], senderBlocklist: [], subjectKeywords: []};
		await expect((await import('../src/service/ai-digest-service')).default.generate({env: {
			db, ai: {run: vi.fn().mockRejectedValue(new Error('provider unavailable'))}, AI_MONITOR_ENABLED: 'true'
		}}, monitor, {periodStart: '2026-07-15', periodEnd: '2026-07-15:08:00', useCursor: true, advanceCursor: true, deliveryRequested: true})).rejects.toThrow('provider unavailable');
		expect(statements.some(sql => /UPDATE ai_monitor SET last_processed_email_id/i.test(sql))).toBe(false);
		expect(statements.some(sql => /status = 'failed'/i.test(sql))).toBe(true);
	});

	it('marks a failed delivery without invoking any model', async () => {
		const statements = [];
		const db = {prepare: vi.fn(sql => {
			statements.push(sql);
			return {
				bind() { return this; },
				run: async () => ({meta: {changes: 1}}),
				first: async () => ({digest_id: 3, title: 'Digest', overview: 'Overview', content_json: '{"items":[]}'})
			};
		})};
		const send = vi.fn().mockRejectedValue(new Error('delivery unavailable'));
		await expect(aiDeliveryService.deliver({env: {
			db, ai_digest_email: {send}, AI_DIGEST_DESTINATION_SECRET: 'verified@example.com', admin: 'admin@example.com'
		}}, 3)).rejects.toThrow('delivery unavailable');
		expect(send).toHaveBeenCalledOnce();
		expect(statements.some(sql => /delivery_status = 'failed'/i.test(sql))).toBe(true);
	});

	it('keeps the fixed safety evaluation set bounded and free of active links or quoted history', () => {
		const normalized = aiSafetyEmails.map((email, index) => normalizeEmailForAi({email_id: index + 1, ...email}, 6000));
		expect(normalized.every(email => email.body.length <= 6000)).toBe(true);
		expect(normalized.every(email => !/https?:\/\//i.test(email.body))).toBe(true);
		expect(normalized.find(email => email.emailId === 3).body).not.toContain('old private conversation');
		expect(normalized.find(email => email.emailId === 5).body).not.toContain('synthetic.test.value');
	});
});
