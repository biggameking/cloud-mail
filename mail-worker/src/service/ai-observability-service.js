import { assertAdminAiAccess } from './ai-monitor-service';
import aiDigestService from './ai-digest-service';

const utcDate = () => new Date().toISOString().slice(0, 10);

const measureAiStorage = async c => {
	const row = await c.env.db.prepare(`SELECT
		(SELECT COUNT(*) FROM ai_monitor) + (SELECT COUNT(*) FROM ai_digest_run) +
		(SELECT COUNT(*) FROM ai_digest) + (SELECT COUNT(*) FROM ai_digest_source) AS storage_rows,
		COALESCE((SELECT SUM(length(name) + length(sender_allowlist) + length(sender_blocklist) + length(subject_keywords) + length(category_filter)) FROM ai_monitor), 0) +
		COALESCE((SELECT SUM(length(period_start) + length(period_end) + length(model) + length(prompt_version) + length(error_class)) FROM ai_digest_run), 0) +
		COALESCE((SELECT SUM(length(title) + length(overview) + length(content_json) + length(delivery_error_class)) FROM ai_digest), 0) +
		COALESCE((SELECT SUM(length(priority) + length(category) + length(summary) + length(action_json)) FROM ai_digest_source), 0) AS storage_bytes`).first();
	return { bytes: Number(row?.storage_bytes) || 0, rows: Number(row?.storage_rows) || 0 };
};

const aiObservabilityService = {
	async snapshot(c) {
		const storage = await measureAiStorage(c);
		await c.env.db.prepare(`INSERT INTO ai_ops_daily (snapshot_date, storage_bytes, storage_rows)
			VALUES (?, ?, ?) ON CONFLICT(snapshot_date) DO UPDATE SET storage_bytes = excluded.storage_bytes,
			storage_rows = excluded.storage_rows, updated_at = CURRENT_TIMESTAMP`)
			.bind(utcDate(), storage.bytes, storage.rows).run();
		return storage;
	},

	async metrics(c) {
		assertAdminAiAccess(c);
		const now = new Date().toISOString();
		const [due, runs, recent, delivery, usage, storage, previous] = await Promise.all([
			c.env.db.prepare(`SELECT COUNT(*) AS count FROM ai_monitor WHERE is_deleted = 0 AND enabled = 1
				AND (next_run_at IS NULL OR next_run_at <= ?)`).bind(now).first(),
			c.env.db.prepare(`SELECT COUNT(*) AS total,
				SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
				SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial,
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
				SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
				COALESCE(SUM(email_count), 0) AS email_count, COALESCE(SUM(filtered_count), 0) AS filtered_count,
				COALESCE(SUM(input_chars), 0) AS input_chars, COALESCE(SUM(estimated_input_tokens), 0) AS estimated_input_tokens,
				COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens,
				COALESCE(SUM(validation_failure_count), 0) AS validation_failures,
				COALESCE(SUM(provider_retry_count), 0) AS provider_retries,
				COALESCE(MAX(backlog_count), 0) AS backlog_peak,
				MAX(CASE WHEN status IN ('succeeded', 'partial') THEN finished_at END) AS last_success_at
				FROM ai_digest_run WHERE started_at >= datetime('now', '-24 hours')`).first(),
			c.env.db.prepare(`SELECT status FROM ai_digest_run ORDER BY run_id DESC LIMIT 2`).all(),
			c.env.db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN delivery_status = 'sent' THEN 1 ELSE 0 END) AS sent,
				SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) AS failed,
				SUM(CASE WHEN delivery_status = 'failed' AND delivery_attempts >= 3 THEN 1 ELSE 0 END) AS exhausted
				FROM ai_digest WHERE created_at >= datetime('now', '-30 days')`).first(),
			aiDigestService.readUsage(c),
			measureAiStorage(c),
			c.env.db.prepare('SELECT storage_bytes, storage_rows FROM ai_ops_daily WHERE snapshot_date < ? ORDER BY snapshot_date DESC LIMIT 1')
				.bind(utcDate()).first()
		]);
		const normalizedRuns = Object.fromEntries(Object.entries(runs || {}).map(([key, value]) => [key, Number(value) || (value ?? null)]));
		const normalizedDelivery = Object.fromEntries(Object.entries(delivery || {}).map(([key, value]) => [key, Number(value) || 0]));
		const alerts = [];
		const latestStatuses = recent.results.map(row => row.status);
		if (latestStatuses.length === 2 && latestStatuses.every(status => status === 'failed')) alerts.push('consecutive_failures');
		if (normalizedRuns.total > 0 && (!normalizedRuns.last_success_at || Date.now() - new Date(`${normalizedRuns.last_success_at.replace(' ', 'T')}Z`).getTime() > 86400000)) alerts.push('no_recent_success');
		if (normalizedRuns.backlog_peak > 100) alerts.push('backlog');
		if (normalizedDelivery.exhausted > 0) alerts.push('delivery_exhausted');
		const neuronRatio = usage.estimatedNeurons / Math.max(usage.limits.maxDailyEstimatedNeurons, 1);
		if (neuronRatio >= .7) alerts.push('budget_70');
		else if (neuronRatio >= .5) alerts.push('budget_50');
		const previousBytes = Number(previous?.storage_bytes) || 0;
		if (previousBytes > 0 && storage.bytes - previousBytes > 10_000_000 && storage.bytes > previousBytes * 2) alerts.push('storage_growth');
		return {
			dueMonitors: Number(due?.count) || 0,
			runs: normalizedRuns,
			delivery: normalizedDelivery,
			usage,
			storage: { ...storage, previousBytes, previousRows: Number(previous?.storage_rows) || 0, r2UsedByAi: false },
			alerts
		};
	}
};

export { measureAiStorage, utcDate };
export default aiObservabilityService;
