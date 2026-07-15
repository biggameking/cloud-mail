import emailUtils from '../utils/email-utils';

const SECRET_PATTERNS = [
	/\b(?:bearer|basic)\s+[a-z0-9._~+/=-]+/gi,
	/\b(?:authorization|cookie|password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s,;]+/gi,
	/\b(?:\d[ -]*?){13,19}\b/g,
	/\b\d{6}\b/g
];

const normalizeWhitespace = value => value.replace(/\u0000/g, '').replace(/[\t\r ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const trimQuotedContent = value => {
	const markers = [
		/^On .{0,200}wrote:\s*$/im,
		/^-{2,}\s*Original Message\s*-{2,}$/im,
		/^(?:From|发件人):\s*.+$/im,
		/^>+/m,
		/^--\s*$/m,
		/^Sent from my\s+/im
	];
	let end = value.length;
	for (const pattern of markers) {
		const match = pattern.exec(value);
		if (match && match.index < end) end = match.index;
	}
	return value.slice(0, end);
};

const removeLinks = value => value.replace(/https?:\/\/[^\s<>()]+/gi, '[LINK]');

const redactSensitiveText = value => SECRET_PATTERNS.reduce(
	(result, pattern) => result.replace(pattern, '[REDACTED]'),
	value
);

const normalizeEmailForAi = (email, maxChars = 8000) => {
	const safeLimit = Math.min(Math.max(Number(maxChars) || 8000, 1), 20000);
	const sourceText = email.text || emailUtils.htmlToText(email.content || email.html || '') || '';
	const cleanText = trimQuotedContent(removeLinks(normalizeWhitespace(String(sourceText))));
	return {
		emailId: Number(email.email_id ?? email.emailId),
		from: normalizeWhitespace(String(email.send_email || email.from || '')).slice(0, 320),
		subject: redactSensitiveText(normalizeWhitespace(String(email.subject || ''))).slice(0, 500),
		body: redactSensitiveText(cleanText).slice(0, safeLimit),
		receivedAt: String(email.create_time || email.receivedAt || '')
	};
};

export { normalizeEmailForAi, normalizeWhitespace, redactSensitiveText, removeLinks, trimQuotedContent };
