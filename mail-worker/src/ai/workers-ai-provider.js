import AiProvider from './ai-provider';
import { DEFAULT_AI_MODEL } from './ai-config';

class WorkersAiProvider extends AiProvider {
	constructor(aiBinding, model = DEFAULT_AI_MODEL) {
		super();
		if (!aiBinding?.run) throw new Error('Workers AI binding is unavailable');
		this.aiBinding = aiBinding;
		this.model = model;
	}

	async generateDigest({ systemPrompt, userPrompt, maxTokens = 2048 }) {
		return this.aiBinding.run(this.model, {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			temperature: 0.1,
			max_tokens: Math.min(Math.max(maxTokens, 256), 4096),
			response_format: { type: 'json_object' }
		});
	}
}

export default WorkersAiProvider;
