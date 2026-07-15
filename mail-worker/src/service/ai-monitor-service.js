import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import { nextDailyRun } from '../ai/ai-schedule';

const jsonArray = (value, field) => {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== 'string' || item.length > 320)) {
		throw new BizError(`${t('aiInvalidFilter')}: ${field}`, 400);
	}
	return [...new Set(value.map(item => item.trim().toLowerCase()).filter(Boolean))];
};

const assertAdminAiAccess = c => {
	const currentUser = c.get('user');
	if (!currentUser || currentUser.email !== c.env.admin) throw new BizError(t('unauthorized'), 403);
};

const parseMonitorRow = row => row ? ({
	monitorId: row.monitor_id,
	ownerUserId: row.owner_user_id,
	name: row.name,
	enabled: row.enabled === 1,
	scheduleType: row.schedule_type,
	scheduleTime: row.schedule_time,
	timezone: row.timezone,
	language: row.language,
	destinationKey: row.destination_key,
	includeRead: row.include_read === 1,
	senderAllowlist: JSON.parse(row.sender_allowlist || '[]'),
	senderBlocklist: JSON.parse(row.sender_blocklist || '[]'),
	subjectKeywords: JSON.parse(row.subject_keywords || '[]'),
	maxEmailsPerRun: row.max_emails_per_run,
	maxCharsPerEmail: row.max_chars_per_email,
	lastProcessedEmailId: row.last_processed_email_id,
	nextRunAt: row.next_run_at,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	accountIds: []
}) : null;

const validateMonitorInput = body => {
	const name = String(body.name || '').trim();
	if (!name || name.length > 100) throw new BizError(t('aiInvalidMonitorName'), 400);
	const accountIds = [...new Set((body.accountIds || []).map(Number))];
	if (!accountIds.length || accountIds.length > 100 || accountIds.some(id => !Number.isInteger(id) || id <= 0)) {
		throw new BizError(t('aiSelectMailbox'), 400);
	}
	const maxEmailsPerRun = Math.min(Math.max(Number(body.maxEmailsPerRun) || 50, 1), 200);
	const maxCharsPerEmail = Math.min(Math.max(Number(body.maxCharsPerEmail) || 6000, 500), 20000);
	return {
		name,
		enabled: body.enabled === true ? 1 : 0,
		accountIds,
		includeRead: body.includeRead === false ? 0 : 1,
		senderAllowlist: jsonArray(body.senderAllowlist, 'senderAllowlist'),
		senderBlocklist: jsonArray(body.senderBlocklist, 'senderBlocklist'),
		subjectKeywords: jsonArray(body.subjectKeywords, 'subjectKeywords'),
		maxEmailsPerRun,
		maxCharsPerEmail
	};
};

const aiMonitorService = {
	assertAdminAiAccess,

	async accounts(c) {
		assertAdminAiAccess(c);
		const { results } = await c.env.db.prepare(`SELECT
			a.account_id AS accountId, a.email, a.user_id AS userId, u.email AS userEmail
			FROM account a JOIN user u ON u.user_id = a.user_id
			WHERE a.is_del = 0 AND a.status = 0 AND u.is_del = 0 AND u.status = 0
			ORDER BY u.email COLLATE NOCASE, a.email COLLATE NOCASE`).all();
		return results;
	},

	async list(c) {
		assertAdminAiAccess(c);
		const { results } = await c.env.db.prepare('SELECT * FROM ai_monitor ORDER BY monitor_id DESC').all();
		const monitors = results.map(parseMonitorRow);
		if (!monitors.length) return monitors;
		const mappings = await c.env.db.prepare('SELECT monitor_id, account_id FROM ai_monitor_account ORDER BY account_id').all();
		const byMonitor = new Map(monitors.map(monitor => [monitor.monitorId, monitor]));
		for (const mapping of mappings.results) byMonitor.get(mapping.monitor_id)?.accountIds.push(mapping.account_id);
		return monitors;
	},

	async get(c, monitorId) {
		assertAdminAiAccess(c);
		const id = Number(monitorId);
		if (!Number.isInteger(id) || id <= 0) throw new BizError(t('aiInvalidMonitor'), 400);
		const row = await c.env.db.prepare('SELECT * FROM ai_monitor WHERE monitor_id = ?').bind(id).first();
		if (!row) throw new BizError(t('aiMonitorNotFound'), 404);
		const monitor = parseMonitorRow(row);
		const mappings = await c.env.db.prepare('SELECT account_id FROM ai_monitor_account WHERE monitor_id = ? ORDER BY account_id').bind(id).all();
		monitor.accountIds = mappings.results.map(item => item.account_id);
		return monitor;
	},

	async validateAccounts(c, accountIds) {
		const placeholders = accountIds.map(() => '?').join(',');
		const { results } = await c.env.db.prepare(`SELECT account_id FROM account a
			JOIN user u ON u.user_id = a.user_id
			WHERE a.account_id IN (${placeholders}) AND a.is_del = 0 AND a.status = 0 AND u.is_del = 0 AND u.status = 0`)
			.bind(...accountIds).all();
		if (results.length !== accountIds.length) throw new BizError(t('aiMailboxUnavailable'), 400);
	},

	async create(c, body) {
		assertAdminAiAccess(c);
		const input = validateMonitorInput(body);
		await this.validateAccounts(c, input.accountIds);
		const nextRunAt = input.enabled ? nextDailyRun('08:00', 'Asia/Shanghai') : null;
		const insert = await c.env.db.prepare(`INSERT INTO ai_monitor (
			owner_user_id, name, enabled, include_read, sender_allowlist, sender_blocklist,
			subject_keywords, max_emails_per_run, max_chars_per_email, next_run_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(
			c.get('user').userId, input.name, input.enabled, input.includeRead,
			JSON.stringify(input.senderAllowlist), JSON.stringify(input.senderBlocklist), JSON.stringify(input.subjectKeywords),
			input.maxEmailsPerRun, input.maxCharsPerEmail, nextRunAt
		).run();
		const monitorId = Number(insert.meta.last_row_id);
		await c.env.db.batch(input.accountIds.map(accountId => c.env.db.prepare(
			'INSERT INTO ai_monitor_account (monitor_id, account_id) VALUES (?, ?)'
		).bind(monitorId, accountId)));
		return this.get(c, monitorId);
	},

	async update(c, monitorId, body) {
		assertAdminAiAccess(c);
		const current = await this.get(c, monitorId);
		const input = validateMonitorInput(body);
		await this.validateAccounts(c, input.accountIds);
		const id = current.monitorId;
		const nextRunAt = input.enabled ? (current.enabled && current.nextRunAt ? current.nextRunAt : nextDailyRun('08:00', 'Asia/Shanghai')) : null;
		const statements = [
			c.env.db.prepare(`UPDATE ai_monitor SET name = ?, enabled = ?, include_read = ?, sender_allowlist = ?,
				sender_blocklist = ?, subject_keywords = ?, max_emails_per_run = ?, max_chars_per_email = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP
				WHERE monitor_id = ?`).bind(
				input.name, input.enabled, input.includeRead, JSON.stringify(input.senderAllowlist),
				JSON.stringify(input.senderBlocklist), JSON.stringify(input.subjectKeywords), input.maxEmailsPerRun,
				input.maxCharsPerEmail, nextRunAt, id
			),
			c.env.db.prepare('DELETE FROM ai_monitor_account WHERE monitor_id = ?').bind(id),
			...input.accountIds.map(accountId => c.env.db.prepare(
				'INSERT INTO ai_monitor_account (monitor_id, account_id) VALUES (?, ?)'
			).bind(id, accountId))
		];
		await c.env.db.batch(statements);
		return this.get(c, id);
	},

	async remove(c, monitorId) {
		assertAdminAiAccess(c);
		const current = await this.get(c, monitorId);
		await c.env.db.batch([
			c.env.db.prepare('DELETE FROM ai_monitor_account WHERE monitor_id = ?').bind(current.monitorId),
			c.env.db.prepare('DELETE FROM ai_monitor WHERE monitor_id = ?').bind(current.monitorId)
		]);
	}
};

export { assertAdminAiAccess, parseMonitorRow, validateMonitorInput };
export default aiMonitorService;
