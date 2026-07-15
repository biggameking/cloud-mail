const PRIORITIES = new Set(['high', 'medium', 'low']);
const CATEGORIES = new Set(['action_required', 'deadline', 'notification', 'finance', 'account_security', 'newsletter', 'other']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const UNSAFE_CONTENT = /<\/?(?:script|iframe|img|object|embed|form)\b|https?:\/\/|\b(?:authorization|cookie|password|secret|api[_-]?key)\s*[:=]/i;

const requireSafeString = (value, field, maxLength, { nullable = false } = {}) => {
	if (nullable && value === null) return null;
	if (typeof value !== 'string' || value.length > maxLength || UNSAFE_CONTENT.test(value)) {
		throw new Error(`Invalid AI output field: ${field}`);
	}
	return value.trim();
};

const parseProviderContent = raw => {
	const value = typeof raw === 'string' ? raw : raw?.response;
	if (typeof value !== 'string' || value.length > 100000) throw new Error('Invalid AI provider response');
	return JSON.parse(value);
};

const validateDigestOutput = (raw, allowedEmailIds) => {
	const value = typeof raw === 'string' || raw?.response ? parseProviderContent(raw) : raw;
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI digest object');
	const allowed = new Set([...allowedEmailIds].map(Number));
	if (!Array.isArray(value.items) || value.items.length > Math.min(allowed.size, 200)) throw new Error('Invalid AI digest items');

	const seen = new Set();
	const items = value.items.map((item, index) => {
		if (!item || typeof item !== 'object' || !Number.isInteger(item.emailId) || !allowed.has(item.emailId) || seen.has(item.emailId)) {
			throw new Error(`Invalid AI output emailId at item ${index}`);
		}
		seen.add(item.emailId);
		if (!PRIORITIES.has(item.priority) || !CATEGORIES.has(item.category)) throw new Error(`Invalid AI output enum at item ${index}`);
		if (!Array.isArray(item.actions) || item.actions.length > 10) throw new Error(`Invalid AI output actions at item ${index}`);
		return {
			emailId: item.emailId,
			priority: item.priority,
			category: item.category,
			summary: requireSafeString(item.summary, `items[${index}].summary`, 1000),
			actions: item.actions.map((action, actionIndex) => {
				if (!action || typeof action !== 'object' || !CONFIDENCE.has(action.confidence)) throw new Error(`Invalid AI output action at item ${index}`);
				return {
					text: requireSafeString(action.text, `items[${index}].actions[${actionIndex}].text`, 500),
					dueAt: requireSafeString(action.dueAt, `items[${index}].actions[${actionIndex}].dueAt`, 64, { nullable: true }),
					confidence: action.confidence
				};
			})
		};
	});

	return {
		title: requireSafeString(value.title, 'title', 200),
		overview: requireSafeString(value.overview, 'overview', 2000),
		items
	};
};

export { CATEGORIES, PRIORITIES, validateDigestOutput };
