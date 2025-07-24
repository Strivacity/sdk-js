export class FallbackError extends Error {
	constructor(public url: URL) {
		super('Fallback occurred');
		this.name = 'FallbackError';
	}
}
