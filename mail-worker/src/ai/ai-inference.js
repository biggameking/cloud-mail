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
		return { raw, digest: validateDigestOutput(raw, allowedEmailIds), retried: false, attempts: 1, validationFailures: 0, providerRetries: 0 };
	} catch (error) {
		const validationFailure = stage === 'validation';
		const meta = { attempts: 1, validationFailures: validationFailure ? 1 : 0, providerRetries: 0 };
		if (!validationFailure && !isTransientProviderError(error)) {
			error.aiInferenceMeta = meta;
			throw error;
		}
		if (!await reserveRetry({ reason: validationFailure ? 'invalid_output' : 'transient_provider' })) {
			error.aiInferenceMeta = meta;
			throw error;
		}
		const retrySystemPrompt = validationFailure ? `${systemPrompt}\n${JSON_REPAIR_INSTRUCTION}` : systemPrompt;
		meta.attempts = 2;
		meta.providerRetries = validationFailure ? 0 : 1;
		try {
			const raw = await provider.generateDigest({ systemPrompt: retrySystemPrompt, userPrompt });
			return {
				raw,
				digest: validateDigestOutput(raw, allowedEmailIds),
				retried: true,
				retryReason: validationFailure ? 'invalid_output' : 'transient_provider',
				...meta
			};
		} catch (retryError) {
			if (validationFailure || retryError?.name === 'SyntaxError' || retryError?.name === 'TypeError') meta.validationFailures += 1;
			retryError.aiInferenceMeta = meta;
			throw retryError;
		}
	}
};

export { JSON_REPAIR_INSTRUCTION, generateValidatedDigest, isTransientProviderError };
