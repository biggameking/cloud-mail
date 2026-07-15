import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';

const PRIORITIES = new Set(['high', 'medium', 'low']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const positiveInteger = (value, field) => {
	if (value === undefined || value === null || value === '') return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) throw new BizError(`${t('aiInvalidDigestFilter')}: ${field}`, 400);
	return parsed;
};

const calendarDate = (value, field) => {
	if (value === undefined || value === null || value === '') return null;
	const text = String(value);
	if (!DATE_PATTERN.test(text) || new Date(`${text}T00:00:00.000Z`).toISOString().slice(0, 10) !== text) {
		throw new BizError(`${t('aiInvalidDigestFilter')}: ${field}`, 400);
	}
	return text;
};

const normalizeDigestFilters = query => {
	const filters = {
		monitorId: positiveInteger(query?.monitorId, 'monitorId'),
		accountId: positiveInteger(query?.accountId, 'accountId'),
		priority: query?.priority ? String(query.priority) : null,
		dateFrom: calendarDate(query?.dateFrom, 'dateFrom'),
		dateTo: calendarDate(query?.dateTo, 'dateTo')
	};
	if (filters.priority && !PRIORITIES.has(filters.priority)) {
		throw new BizError(`${t('aiInvalidDigestFilter')}: priority`, 400);
	}
	if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
		throw new BizError(`${t('aiInvalidDigestFilter')}: dateRange`, 400);
	}
	return filters;
};

export { normalizeDigestFilters, PRIORITIES };
