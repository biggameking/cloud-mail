import { getAiConfig } from '../ai/ai-config';
import aiObservabilityService from './ai-observability-service';

const aiRetentionService = {
	async cleanup(c) {
		if (!getAiConfig(c.env).enabled) return { status: 'disabled' };
		const expired = await c.env.db.prepare(`SELECT digest_id FROM ai_digest
			WHERE retained = 0 AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
			ORDER BY digest_id ASC LIMIT 500`).all();
		const ids = expired.results.map(row => row.digest_id);
		if (ids.length) {
			const placeholders = ids.map(() => '?').join(',');
			await c.env.db.batch([
				c.env.db.prepare(`DELETE FROM ai_digest_source WHERE digest_id IN (${placeholders})`).bind(...ids),
				c.env.db.prepare(`DELETE FROM ai_digest WHERE digest_id IN (${placeholders})`).bind(...ids)
			]);
		}
		await c.env.db.batch([
			c.env.db.prepare(`DELETE FROM ai_digest_source WHERE NOT EXISTS (
				SELECT 1 FROM ai_digest d WHERE d.digest_id = ai_digest_source.digest_id
			)`),
			c.env.db.prepare(`DELETE FROM ai_digest_run WHERE run_id IN (
				SELECT r.run_id FROM ai_digest_run r LEFT JOIN ai_digest d ON d.run_id = r.run_id
				WHERE d.digest_id IS NULL AND r.finished_at < datetime('now', '-90 days') LIMIT 500
			)`)
		]);
		const storage = await aiObservabilityService.snapshot(c);
		return { status: 'completed', deletedDigests: ids.length, storage };
	}
};

export default aiRetentionService;
