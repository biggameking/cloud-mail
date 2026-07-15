class AiProvider {
	async generateDigest() {
		throw new Error('AiProvider.generateDigest must be implemented');
	}
}

export default AiProvider;
