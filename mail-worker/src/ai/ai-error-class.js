const classifyAiError = (error, fallback = 'provider_error') => {
	const message = String(error?.message || '');
	const status = Number(error?.status || error?.statusCode);
	if (/EXCEEDED_CPU/i.test(message)) return 'exceeded_cpu';
	if (/\b(?:quota|rate.?limit|too many requests)\b/i.test(message) || status === 429) return 'ai_quota';
	if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /\b(?:timed?\s*out|timeout)\b/i.test(message)) return 'provider_timeout';
	if (status >= 500) return 'provider_5xx';
	if (status >= 400) return 'provider_4xx';
	if (error?.name === 'SyntaxError' || error?.name === 'TypeError') return 'output_validation';
	return fallback;
};

export { classifyAiError };
