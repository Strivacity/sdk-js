export class FallbackError extends Error {
	constructor(public url: URL) {
		super('Fallback occurred');
		this.name = 'FallbackError';
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
