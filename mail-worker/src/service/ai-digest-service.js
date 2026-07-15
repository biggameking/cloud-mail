import BizError from '../error/biz-error';
import aiMonitorService, { assertAdminAiAccess } from './ai-monitor-service';
import { getAiConfig } from '../ai/ai-config';
import { normalizeEmailForAi } from '../ai/email-normalizer';
import { buildDigestPrompt, DIGEST_SYSTEM_PROMPT, PROMPT_VERSION } from '../ai/ai-prompt';
import { validateDigestOutput } from '../ai/ai-output-validator';
import { checkAiBudget, estimateNeurons, estimateTokens } from '../ai/ai-budget';
import WorkersAiProvider from '../ai/workers-ai-provider';
import { t } from '../i18n/i18n';

const todayUtc = () => new Date().toISOString().slice(0, 10);
const safeErrorClass = error => ['SyntaxError', 'TypeError', 'Error'].includes(error?.name) ? error.name : 'ProviderError';

const filterEmail = (email, monitor) => {
	const sender = String(email.send_email || '').toLowerCase();
	const senderDomain = sender.split('@')[1] || '';
	const subject = String(email.subject || '').toLowerCase();
	const matches = list => list.some(item => sender === item || senderDomain === item.replace(/^@/, ''));
	if (monitor.senderAllowlist.length && !matches(monitor.senderAllowlist)) return false;
	if (monitor.senderBlocklist.length && matches(monitor.senderBlocklist)) return false;
	if (monitor.subjectKeywords.length && !monitor.subjectKeywords.some(keyword => subject.includes(keyword))) return false;
	return true;
};

const aiDigestService = {
	async readUsage(c) {
		const config = getAiConfig(c.env);
		const row = await c.env.db.prepare(`SELECT calls, input_tokens, output_tokens, estimated_neurons, skipped_runs
			FROM ai_usage_daily WHERE usage_date = ? AND provider = ? AND model = ?`)
			.bind(todayUtc(), config.provider, config.model).first();
		return {
			enabled: config.enabled,
			provider: config.provider,
			model: config.model,
			calls: row?.calls || 0,
			inputTokens: row?.input_tokens || 0,
			outputTokens: row?.output_tokens || 0,
			estimatedNeurons: row?.estimated_neurons || 0,
			skippedRuns: row?.skipped_runs || 0,
			limits: {
				maxDailyCalls: config.maxDailyCalls,
				maxDailyInputTokens: config.maxDailyInputTokens,
				maxDailyOutputTokens: config.maxDailyOutputTokens,
				maxDailyEstimatedNeurons: config.maxDailyEstimatedNeurons
			}
		};
	},

	async usageToday(c) {
		assertAdminAiAccess(c);
		return this.readUsage(c);
	},

	async list(c) {
		assertAdminAiAccess(c);
		const { results } = await c.env.db.prepare(`SELECT d.digest_id AS digestId, d.monitor_id AS monitorId,
			d.title, d.overview, d.important_count AS importantCount, d.action_count AS actionCount,
			d.delivery_status AS deliveryStatus, d.created_at AS createdAt, m.name AS monitorName
			FROM ai_digest d JOIN ai_monitor m ON m.monitor_id = d.monitor_id
			ORDER BY d.digest_id DESC LIMIT 100`).all();
		return results;
	},

	async detail(c, digestId) {
		assertAdminAiAccess(c);
		const id = Number(digestId);
		if (!Number.isInteger(id) || id <= 0) throw new BizError(t('aiInvalidDigest'), 400);
		const digest = await c.env.db.prepare(`SELECT d.*, m.name AS monitor_name FROM ai_digest d
			JOIN ai_monitor m ON m.monitor_id = d.monitor_id WHERE d.digest_id = ?`).bind(id).first();
		if (!digest) throw new BizError(t('aiDigestNotFound'), 404);
		const { results: sources } = await c.env.db.prepare(`SELECT s.email_id AS emailId, s.priority, s.category,
			s.summary, s.action_json AS actionJson, e.subject, e.send_email AS sendEmail, e.to_email AS toEmail,
			e.create_time AS receivedAt
			FROM ai_digest_source s JOIN email e ON e.email_id = s.email_id
			WHERE s.digest_id = ? ORDER BY s.email_id DESC`).bind(id).all();
		return {
			digestId: digest.digest_id,
			monitorId: digest.monitor_id,
			monitorName: digest.monitor_name,
			title: digest.title,
			overview: digest.overview,
			items: sources.map(source => ({ ...source, actions: JSON.parse(source.actionJson || '[]'), actionJson: undefined })),
			importantCount: digest.important_count,
			actionCount: digest.action_count,
			createdAt: digest.created_at
		};
	},

	async source(c, digestId, emailId) {
		assertAdminAiAccess(c);
		const digest = Number(digestId);
		const email = Number(emailId);
		if (!Number.isInteger(digest) || !Number.isInteger(email) || digest <= 0 || email <= 0) {
			throw new BizError(t('aiInvalidDigestSource'), 400);
		}
		const row = await c.env.db.prepare(`SELECT e.email_id AS emailId, e.send_email AS sendEmail, e.name,
			e.account_id AS accountId, e.user_id AS userId, e.subject, e.code, e.text, e.content,
			e.cc, e.bcc, e.recipient, e.to_email AS toEmail, e.to_name AS toName, e.in_reply_to AS inReplyTo,
			e.relation, e.message_id AS messageId, e.type, e.status, e.unread, e.create_time AS createTime,
			0 AS isStar
			FROM ai_digest_source s JOIN email e ON e.email_id = s.email_id
			WHERE s.digest_id = ? AND s.email_id = ? AND e.is_del = 0`).bind(digest, email).first();
		if (!row) throw new BizError(t('aiDigestSourceNotFound'), 404);
		return { ...row, attList: [] };
	},

	async reserveUsage(c, config, usage) {
		const result = await c.env.db.prepare(`INSERT INTO ai_usage_daily (
			usage_date, provider, model, calls, input_tokens, output_tokens, estimated_neurons
		) VALUES (?, ?, ?, 1, ?, ?, ?)
		ON CONFLICT(usage_date, provider, model) DO UPDATE SET
			calls = calls + 1,
			input_tokens = input_tokens + excluded.input_tokens,
			output_tokens = output_tokens + excluded.output_tokens,
			estimated_neurons = estimated_neurons + excluded.estimated_neurons
		WHERE calls + 1 <= ? AND input_tokens + excluded.input_tokens <= ?
			AND output_tokens + excluded.output_tokens <= ? AND estimated_neurons + excluded.estimated_neurons <= ?`)
			.bind(todayUtc(), config.provider, config.model, usage.inputTokens, usage.outputTokens, usage.estimatedNeurons,
				config.maxDailyCalls, config.maxDailyInputTokens, config.maxDailyOutputTokens, config.maxDailyEstimatedNeurons).run();
		return result.meta.changes === 1;
	},

	async recordSkipped(c, config) {
		await c.env.db.prepare(`INSERT INTO ai_usage_daily (usage_date, provider, model, skipped_runs)
			VALUES (?, ?, ?, 1) ON CONFLICT(usage_date, provider, model) DO UPDATE SET skipped_runs = skipped_runs + 1`)
			.bind(todayUtc(), config.provider, config.model).run();
	},

	async preview(c, body) {
		assertAdminAiAccess(c);
		const config = getAiConfig(c.env);
		if (!config.enabled) throw new BizError(t('aiMonitoringDisabled'), 409);
		const monitor = await aiMonitorService.get(c, body.monitorId);
		const generated = await this.generate(c, monitor, {
			periodStart: `manual:${crypto.randomUUID()}`,
			periodEnd: new Date().toISOString(),
			useCursor: false,
			advanceCursor: false,
			deliveryRequested: false
		});
		if (generated.status === 'empty') throw new BizError(t('aiNoEligibleEmails'), 400);
		if (generated.status === 'budget_skipped') throw new BizError(`${t('aiBudgetExceeded')}: ${generated.reasonCode}`, 429);
		if (generated.status !== 'succeeded') throw new BizError(t('aiPreviewUnavailable'), 409);
		return this.detail(c, generated.digestId);
	},

	async generate(c, monitor, options) {
		const config = getAiConfig(c.env);
		if (!config.enabled) return { status: 'disabled' };
		let run;
		try {
			run = await c.env.db.prepare(`INSERT INTO ai_digest_run (
				monitor_id, period_start, period_end, status, model, prompt_version, started_at
			) VALUES (?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)`)
				.bind(monitor.monitorId, options.periodStart, options.periodEnd, config.model, PROMPT_VERSION).run();
		} catch (error) {
			if (/UNIQUE constraint failed/i.test(error?.message || '')) return { status: 'duplicate' };
			throw error;
		}
		const runId = Number(run.meta.last_row_id);
		const placeholders = monitor.accountIds.map(() => '?').join(',');
		const query = `SELECT e.email_id, e.send_email, e.subject, e.text, e.content, e.create_time
			FROM email e JOIN account a ON a.account_id = e.account_id JOIN user u ON u.user_id = e.user_id
			WHERE e.account_id IN (${placeholders}) AND e.type = 0 AND e.is_del = 0 AND e.status != 6
			AND a.is_del = 0 AND a.status = 0 AND u.is_del = 0 AND u.status = 0
			AND e.email_id > ? AND (? = -1 OR e.unread = ?) ORDER BY e.email_id ASC LIMIT ?`;
		const cursor = options.useCursor ? monitor.lastProcessedEmailId : 0;
		const bindingParams = monitor.includeRead
			? [...monitor.accountIds, cursor, -1, -1, monitor.maxEmailsPerRun]
			: [...monitor.accountIds, cursor, 0, 0, monitor.maxEmailsPerRun];
		const { results: candidates } = await c.env.db.prepare(query).bind(...bindingParams).all();
		const selected = candidates.filter(email => filterEmail(email, monitor));
		if (!selected.length) {
			await c.env.db.prepare(`UPDATE ai_digest_run SET status = 'skipped', reason_code = 'no_eligible_email',
				email_count = 0, filtered_count = ?, finished_at = CURRENT_TIMESTAMP WHERE run_id = ?`)
				.bind(candidates.length, runId).run();
			return { status: 'empty', runId };
		}
		const emails = selected.map(email => normalizeEmailForAi(email, monitor.maxCharsPerEmail));
		const userPrompt = buildDigestPrompt({ emails, language: monitor.language });
		const estimatedInputTokens = estimateTokens(DIGEST_SYSTEM_PROMPT.length + userPrompt.length);
		await c.env.db.prepare(`UPDATE ai_digest_run SET status = 'running', email_count = ?, filtered_count = ?,
			input_chars = ?, estimated_input_tokens = ? WHERE run_id = ?`)
			.bind(selected.length, candidates.length - selected.length, userPrompt.length, estimatedInputTokens, runId).run();
		const usage = await this.readUsage(c);
		const budget = checkAiBudget({
			current: usage,
			requested: { inputTokens: estimatedInputTokens, outputTokens: 2048 },
			limits: config
		});
		if (!budget.allowed) {
			await Promise.all([
				this.recordSkipped(c, config),
				c.env.db.prepare(`UPDATE ai_digest_run SET status = 'skipped', reason_code = ?, finished_at = CURRENT_TIMESTAMP WHERE run_id = ?`)
					.bind(budget.reasonCode, runId).run()
			]);
			return { status: 'budget_skipped', reasonCode: budget.reasonCode, runId };
		}
		const reserved = await this.reserveUsage(c, config, {
			inputTokens: estimatedInputTokens,
			outputTokens: 2048,
			estimatedNeurons: estimateNeurons({ inputTokens: estimatedInputTokens, outputTokens: 2048 })
		});
		if (!reserved) {
			await c.env.db.prepare(`UPDATE ai_digest_run SET status = 'skipped', reason_code = 'concurrent_budget_limit',
				finished_at = CURRENT_TIMESTAMP WHERE run_id = ?`).bind(runId).run();
			return { status: 'budget_skipped', reasonCode: 'concurrent_budget_limit', runId };
		}

		try {
			const provider = new WorkersAiProvider(c.env.ai, config.model);
			const raw = await provider.generateDigest({ systemPrompt: DIGEST_SYSTEM_PROMPT, userPrompt });
			const providerContent = typeof raw === 'string' ? raw : raw?.response;
			const rawContent = typeof providerContent === 'string' ? providerContent : JSON.stringify(providerContent || '');
			const inputTokens = Number(raw?.usage?.prompt_tokens) || estimatedInputTokens;
			const outputTokens = Number(raw?.usage?.completion_tokens) || estimateTokens(rawContent.length);
			const digest = validateDigestOutput(raw, emails.map(email => email.emailId));
			const importantCount = digest.items.filter(item => item.priority === 'high').length;
			const actionCount = digest.items.reduce((total, item) => total + item.actions.length, 0);
			const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
			const insertDigest = await c.env.db.prepare(`INSERT INTO ai_digest (
				run_id, monitor_id, title, overview, content_json, important_count, action_count, delivery_status, expires_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
				.bind(runId, monitor.monitorId, digest.title, digest.overview, JSON.stringify(digest), importantCount, actionCount,
					options.deliveryRequested ? 'pending' : 'not_requested', expiresAt).run();
			const digestId = Number(insertDigest.meta.last_row_id);
			const lastEmailId = Math.max(...emails.map(email => email.emailId));
			await c.env.db.batch([
				...digest.items.map(item => c.env.db.prepare(`INSERT INTO ai_digest_source (
					digest_id, email_id, priority, category, summary, action_json
				) VALUES (?, ?, ?, ?, ?, ?)`).bind(digestId, item.emailId, item.priority, item.category, item.summary, JSON.stringify(item.actions))),
				c.env.db.prepare(`UPDATE ai_digest_run SET status = 'succeeded', input_tokens = ?, output_tokens = ?, finished_at = CURRENT_TIMESTAMP
					WHERE run_id = ?`).bind(inputTokens, outputTokens, runId),
				...(options.advanceCursor ? [c.env.db.prepare(`UPDATE ai_monitor SET last_processed_email_id = ?, updated_at = CURRENT_TIMESTAMP
					WHERE monitor_id = ?`).bind(lastEmailId, monitor.monitorId)] : [])
			]);
			return { status: 'succeeded', digestId, runId, lastEmailId };
		} catch (error) {
			await c.env.db.prepare(`UPDATE ai_digest_run SET status = 'failed', error_class = ?, finished_at = CURRENT_TIMESTAMP WHERE run_id = ?`)
				.bind(safeErrorClass(error), runId).run();
			throw error;
		}
	}
};

export { filterEmail, todayUtc };
export default aiDigestService;
