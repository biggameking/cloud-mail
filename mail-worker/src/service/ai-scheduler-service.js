import { getAiConfig } from '../ai/ai-config';
import aiMonitorService, { parseMonitorRow } from './ai-monitor-service';
import aiDigestService from './ai-digest-service';
import aiDeliveryService from './ai-delivery-service';
import { localDateKey, nextDailyRun } from '../ai/ai-schedule';

const aiSchedulerService = {
	async dueMonitors(c, now = new Date()) {
		const { results } = await c.env.db.prepare(`SELECT * FROM ai_monitor WHERE enabled = 1
			AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY COALESCE(next_run_at, created_at) ASC LIMIT 5`)
			.bind(now.toISOString()).all();
		const monitors = results.map(parseMonitorRow);
		for (const monitor of monitors) {
			const mappings = await c.env.db.prepare('SELECT account_id FROM ai_monitor_account WHERE monitor_id = ? ORDER BY account_id')
				.bind(monitor.monitorId).all();
			monitor.accountIds = mappings.results.map(item => item.account_id);
		}
		return monitors.filter(monitor => monitor.accountIds.length);
	},

	async run(c, now = new Date()) {
		if (!getAiConfig(c.env).enabled) return { status: 'disabled' };
		const system = await aiMonitorService.systemState(c, false);
		if (!system.enabled) return { status: 'stopped' };
		const deliveries = system.deliveryEnabled
			? await aiDeliveryService.retryPending(c)
			: [];
		const monitors = await this.dueMonitors(c, now);
		const outcomes = [];
		for (const monitor of monitors) {
			const dateKey = localDateKey(now, monitor.timezone);
			const nextRunAt = nextDailyRun(monitor.scheduleTime, monitor.timezone, now);
			try {
				const outcome = await aiDigestService.generate(c, monitor, {
					periodStart: dateKey,
					periodEnd: `${dateKey}:${monitor.scheduleTime}`,
					useCursor: true,
					advanceCursor: true,
					deliveryRequested: system.deliveryEnabled
				});
				await c.env.db.prepare('UPDATE ai_monitor SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE monitor_id = ?')
					.bind(nextRunAt, monitor.monitorId).run();
				if (system.deliveryEnabled && ['succeeded', 'partial'].includes(outcome.status)) {
					await aiDeliveryService.deliver(c, outcome.digestId);
				}
				outcomes.push({ monitorId: monitor.monitorId, status: outcome.status });
			} catch (error) {
				await c.env.db.prepare('UPDATE ai_monitor SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE monitor_id = ?')
					.bind(nextRunAt, monitor.monitorId).run();
				console.error('AI scheduled digest failed', { monitorId: monitor.monitorId, errorClass: error?.name || 'Error' });
				outcomes.push({ monitorId: monitor.monitorId, status: 'failed' });
			}
		}
		return { status: 'completed', deliveries, outcomes };
	}
};

export default aiSchedulerService;
