import emailUtils from '../utils/email-utils';

const SECRET_PATTERNS = [
	/\b(?:bearer|basic)\s+[a-z0-9._~+/=-]+/gi,
	/\b(?:authorization|cookie|password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s,;]+/gi,
	/\b(?:\d[ -]*?){13,19}\b/g,
	/\b\d{6}\b/g
];

const normalizeWhitespace = value => value.replace(/\u0000/g, '').replace(/[\t\r ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const redactSensitiveText = value => SECRET_PATTERNS.reduce(
	(result, pattern) => result.replace(pattern, '[REDACTED]'),
	value
);

const normalizeEmailForAi = (email, maxChars = 8000) => {
	const safeLimit = Math.min(Math.max(Number(maxChars) || 8000, 1), 20000);
	const sourceText = email.text || emailUtils.htmlToText(email.content || email.html || '') || '';
	return {
		emailId: Number(email.email_id ?? email.emailId),
		from: normalizeWhitespace(String(email.send_email || email.from || '')).slice(0, 320),
		subject: redactSensitiveText(normalizeWhitespace(String(email.subject || ''))).slice(0, 500),
		body: redactSensitiveText(normalizeWhitespace(String(sourceText))).slice(0, safeLimit),
		receivedAt: String(email.create_time || email.receivedAt || '')
	};
};

export { normalizeEmailForAi, normalizeWhitespace, redactSensitiveText };
