import { t } from '../i18n/i18n';
import BizError from '../error/biz-error';
import aiMonitorService, { assertAdminAiAccess, VERIFIED_DESTINATION_KEY } from './ai-monitor-service';

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

const renderDigestEmail = digest => {
	const content = JSON.parse(digest.content_json);
	const items = content.items.map(item => {
		const actions = item.actions.length
			? `<ul>${item.actions.map(action => `<li>${escapeHtml(action.text)}</li>`).join('')}</ul>`
			: '';
		return `<article style="padding:16px 0;border-bottom:1px solid #e5e7eb"><div style="font-size:12px;color:#64748b">${escapeHtml(t(`aiPriority_${item.priority}`))} · ${escapeHtml(t(`aiCategory_${item.category}`))}</div><p style="margin:8px 0;line-height:1.6">${escapeHtml(item.summary)}</p>${actions}</article>`;
	}).join('');
	const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#172033"><main style="max-width:680px;margin:0 auto;padding:28px 20px"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px"><div style="font-size:12px;font-weight:700;color:#1677ff">CLOUD MAIL · AI DIGEST</div><h1 style="font-size:24px;margin:8px 0 12px">${escapeHtml(digest.title)}</h1><p style="line-height:1.7;color:#475569">${escapeHtml(digest.overview)}</p>${items}<p style="margin:20px 0 0;font-size:12px;color:#64748b">${escapeHtml(t('aiDigestEmailDisclaimer'))}</p></div></main></body></html>`;
	const text = [digest.title, digest.overview, ...content.items.flatMap(item => [
		`[${item.priority}/${item.category}] ${item.summary}`,
		...item.actions.map(action => `- ${action.text}`)
	]), t('aiDigestEmailDisclaimer')].join('\n\n');
	return { html, text };
};

const aiDeliveryService = {
	async request(c, digestId) {
		assertAdminAiAccess(c);
		const id = Number(digestId);
		if (!Number.isInteger(id) || id <= 0) throw new BizError(t('aiInvalidDigest'), 400);
		const system = await aiMonitorService.systemState(c, false);
		if (!system.environmentEnabled || !system.enabled || !system.deliveryEnabled) {
			throw new BizError(t('aiDeliveryDisabled'), 409);
		}
		if (!c.env.ai_digest_email || !c.env.AI_DIGEST_DESTINATION_SECRET) {
			throw new BizError(t('aiDeliveryUnavailable'), 503);
		}
		const digest = await c.env.db.prepare('SELECT delivery_status, delivery_attempts FROM ai_digest WHERE digest_id = ?')
			.bind(id).first();
		if (!digest) throw new BizError(t('aiDigestNotFound'), 404);
		if (digest.delivery_status === 'sent') return { status: 'sent' };
		if (digest.delivery_status === 'sending') return { status: 'sending' };
		if (digest.delivery_attempts >= 3) throw new BizError(t('aiDeliveryAttemptsExceeded'), 409);
		if (digest.delivery_status === 'not_requested') {
			await c.env.db.prepare("UPDATE ai_digest SET delivery_status = 'pending' WHERE digest_id = ? AND delivery_status = 'not_requested'")
				.bind(id).run();
		}
		return this.deliver(c, id);
	},

	async deliver(c, digestId) {
		if (!c.env.ai_digest_email || !c.env.AI_DIGEST_DESTINATION_SECRET) return { status: 'unconfigured' };
		const claim = await c.env.db.prepare(`UPDATE ai_digest SET delivery_status = 'sending', delivery_attempts = delivery_attempts + 1
			WHERE digest_id = ? AND delivery_status IN ('pending', 'failed') AND delivery_attempts < 3`).bind(digestId).run();
		if (!claim.meta.changes) return { status: 'not_claimed' };
		const digest = await c.env.db.prepare('SELECT * FROM ai_digest WHERE digest_id = ?').bind(digestId).first();
		if (!digest) return { status: 'not_found' };
		try {
			const rendered = renderDigestEmail(digest);
			await c.env.ai_digest_email.send({
				to: c.env.AI_DIGEST_DESTINATION_SECRET,
				from: { email: c.env.admin, name: 'Cloud Mail' },
				subject: digest.title,
				html: rendered.html,
				text: rendered.text,
				headers: { 'X-CloudMail-Digest-Id': String(digest.digest_id) }
			});
			await c.env.db.prepare(`UPDATE ai_digest SET delivery_status = 'sent', delivered_at = CURRENT_TIMESTAMP WHERE digest_id = ?`)
				.bind(digestId).run();
			return { status: 'sent' };
		} catch (error) {
			await c.env.db.prepare(`UPDATE ai_digest SET delivery_status = 'failed' WHERE digest_id = ?`).bind(digestId).run();
			throw error;
		}
	},

	async retryPending(c) {
		if (!c.env.ai_digest_email || !c.env.AI_DIGEST_DESTINATION_SECRET) return [];
		const { results } = await c.env.db.prepare(`SELECT d.digest_id FROM ai_digest d
			JOIN ai_monitor m ON m.monitor_id = d.monitor_id
			WHERE d.delivery_status IN ('pending', 'failed') AND d.delivery_attempts < 3
			AND m.is_deleted = 0 AND m.enabled = 1 AND m.destination_key = ? ORDER BY d.digest_id ASC LIMIT 10`)
			.bind(VERIFIED_DESTINATION_KEY).all();
		const outcomes = [];
		for (const row of results) {
			try { outcomes.push(await this.deliver(c, row.digest_id)); }
			catch (error) { outcomes.push({ status: 'failed', errorClass: error?.name || 'DeliveryError' }); }
		}
		return outcomes;
	}
};

export { escapeHtml, renderDigestEmail };
export default aiDeliveryService;
