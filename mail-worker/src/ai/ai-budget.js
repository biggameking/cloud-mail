const estimateTokens = characters => Math.ceil(Math.max(0, Number(characters) || 0) / 4);

const estimateNeurons = ({ inputTokens = 0, outputTokens = 0 }) => Math.ceil(
	(Math.max(0, inputTokens) * 5 + Math.max(0, outputTokens) * 20) / 1000
);

const checkAiBudget = ({ current = {}, requested = {}, limits }) => {
	const projected = {
		calls: (current.calls || 0) + 1,
		inputTokens: (current.inputTokens || 0) + (requested.inputTokens || 0),
		outputTokens: (current.outputTokens || 0) + (requested.outputTokens || 0),
		estimatedNeurons: (current.estimatedNeurons || 0) + estimateNeurons(requested)
	};
	const checks = [
		['daily_calls', projected.calls, limits.maxDailyCalls],
		['daily_input_tokens', projected.inputTokens, limits.maxDailyInputTokens],
		['daily_output_tokens', projected.outputTokens, limits.maxDailyOutputTokens],
		['daily_estimated_neurons', projected.estimatedNeurons, limits.maxDailyEstimatedNeurons]
	];
	const exceeded = checks.find(([, value, limit]) => value > limit);
	return { allowed: !exceeded, reasonCode: exceeded?.[0] || '', projected };
};

export { checkAiBudget, estimateNeurons, estimateTokens };
