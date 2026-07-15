import BizError from '../error/biz-error';
import verifyUtils from './verify-utils';
import emailUtils from './email-utils';

export function normalizeForwardingTarget({ sourceEmail, targetEmail, managedDomains, enabled }) {
	if (!enabled) return '';
	const target = String(targetEmail || '').trim().toLowerCase();
	if (!verifyUtils.isEmail(target)) throw new BizError('Invalid forwarding address', 400);
	if (target === String(sourceEmail || '').toLowerCase()) {
		throw new BizError('Forwarding to the source address is not allowed', 400);
	}
	if (managedDomains.includes(emailUtils.getDomain(target))) {
		throw new BizError('Forwarding to a managed domain is not allowed', 400);
	}
	return target;
}
