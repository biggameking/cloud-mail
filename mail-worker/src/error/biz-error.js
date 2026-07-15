class BizError extends Error {
	constructor(message, code) {
		super(message);
		this.code = code ?? 400;
		this.name = 'BizError';
	}
}

export default BizError;
