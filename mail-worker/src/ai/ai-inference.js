import { validateDigestOutput } from './ai-output-validator';

const JSON_REPAIR_INSTRUCTION = 'The previous response did not satisfy the required JSON contract. Return one corrected JSON object only. Do not add Markdown, commentary, tools, links, or fields outside the schema.';

const isTransientProviderError = error => {
	const status = Number(error?.status || error?.statusCode);
	return error?.name === 'TimeoutError'
		|| error?.name === 'AbortError'
		|| status === 408
		|| status >= 500
		|| /\b(?:timed?\s*out|timeout)\b/i.test(String(error?.message || ''));
};

const generateValidatedDigest = async ({
	provider,
	systemPrompt,
	userPrompt,
	allowedEmailIds,
	reserveRetry
}) => {
	let stage = 'provider';
	try {
		const raw = await provider.generateDigest({ systemPrompt, userPrompt });
		stage = 'validation';
		return { raw, digest: validateDigestOutput(raw, allowedEmailIds), retried: false };
	} catch (error) {
		const validationFailure = stage === 'validation';
		if (!validationFailure && !isTransientProviderError(error)) throw error;
		if (!await reserveRetry({ reason: validationFailure ? 'invalid_output' : 'transient_provider' })) throw error;
		const retrySystemPrompt = validationFailure ? `${systemPrompt}\n${JSON_REPAIR_INSTRUCTION}` : systemPrompt;
		const raw = await provider.generateDigest({ systemPrompt: retrySystemPrompt, userPrompt });
		return {
			raw,
			digest: validateDigestOutput(raw, allowedEmailIds),
			retried: true,
			retryReason: validationFailure ? 'invalid_output' : 'transient_provider'
		};
	}
};

export { JSON_REPAIR_INSTRUCTION, generateValidatedDigest, isTransientProviderError };
