export class FallbackError extends Error {
	constructor(
		public url: URL,
		message?: string,
	) {
		super('Fallback occurred');
		this.name = 'FallbackError';
		this.message = message ? `Fallback occurred: ${message}` : 'Fallback occurred';
	}
}

/**
 * Error thrown when a popup window is blocked by the browser.
 */
export class PopupBlockedError extends Error {
	constructor(message = 'Popup window blocked') {
		super(message);
		this.name = 'PopupBlockedError';
		Object.setPrototypeOf(this, PopupBlockedError.prototype);
	}
}

/**
 * Error thrown when a popup window is closed by the user before completion.
 */
export class PopupClosedError extends Error {
	constructor(message = 'Popup closed by user') {
		super(message);
		this.name = 'PopupClosedError';
		Object.setPrototypeOf(this, PopupClosedError.prototype);
	}
}

export class UnsupportedFlowError extends Error {
	constructor(message = 'Unsupported flow mode') {
		super(message);
		this.name = 'UnsupportedFlowError';
		Object.setPrototypeOf(this, UnsupportedFlowError.prototype);
	}
}

export class SDKNotInitializedError extends Error {
	constructor(message = 'SDK not initialized') {
		super(message);
		this.name = 'SDKNotInitializedError';
		Object.setPrototypeOf(this, SDKNotInitializedError.prototype);
	}
}

export class NotAuthenticatedError extends Error {
	constructor(message = 'Not authenticated') {
		super(message);
		this.name = 'NotAuthenticatedError';
		Object.setPrototypeOf(this, NotAuthenticatedError.prototype);
	}
}

export class MyAccountApiError extends Error {
	readonly body: unknown;

	constructor(message: string, status: number, body: unknown) {
		super(message);
		this.status = status;
		this.body = body;
		this.name = 'MyAccountApiError';
	}

	public readonly status: number;
}
