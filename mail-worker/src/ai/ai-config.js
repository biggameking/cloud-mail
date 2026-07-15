const DEFAULT_AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

const parsePositiveInteger = (value, fallback, maximum) => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.min(parsed, maximum);
};

const isAiMonitorEnabled = (env = {}) => env.AI_MONITOR_ENABLED === 'true';

const getAiConfig = (env = {}) => ({
	enabled: isAiMonitorEnabled(env),
	provider: 'workers-ai',
	model: env.AI_MONITOR_MODEL || DEFAULT_AI_MODEL,
	maxDailyCalls: parsePositiveInteger(env.AI_MAX_DAILY_CALLS, 4, 48),
	maxDailyInputTokens: parsePositiveInteger(env.AI_MAX_DAILY_INPUT_TOKENS, 500000, 2000000),
	maxDailyOutputTokens: parsePositiveInteger(env.AI_MAX_DAILY_OUTPUT_TOKENS, 20000, 100000),
	maxDailyEstimatedNeurons: parsePositiveInteger(env.AI_MAX_DAILY_ESTIMATED_NEURONS, 7000, 9000),
	attachmentsEnabled: false,
	externalProvidersEnabled: false
});

export { DEFAULT_AI_MODEL, getAiConfig, isAiMonitorEnabled, parsePositiveInteger };
