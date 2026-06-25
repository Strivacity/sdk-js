export type FailureCategory = 'Network' | 'Server' | 'Oidc' | 'Protocol' | 'InvalidRequest' | 'Internal' | 'Unknown';

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

export class SessionExpiredError extends Error {
	constructor(message = 'Session expired') {
		super(message);
		this.name = 'SessionExpiredError';
		Object.setPrototypeOf(this, SessionExpiredError.prototype);
	}
}

export class NetworkError extends Error {
	readonly category: FailureCategory = 'Network';
	readonly recoverable = true;

	constructor(message = 'Network request failed') {
		super(message);
		this.name = 'NetworkError';
		Object.setPrototypeOf(this, NetworkError.prototype);
	}
}

export class ServerError extends Error {
	readonly category: FailureCategory = 'Server';
	readonly recoverable = true;

	constructor(
		message: string,
		public status?: number,
	) {
		super(message);
		this.name = 'ServerError';
		Object.setPrototypeOf(this, ServerError.prototype);
	}
}

export class OidcError extends Error {
	readonly category: FailureCategory = 'Oidc';
	readonly recoverable = false;

	constructor(
		public error: string,
		public errorDescription?: string | null,
		public errorUri?: string | null,
	) {
		super(errorDescription ? `${error}: ${errorDescription}` : error);
		this.name = 'OidcError';
		Object.setPrototypeOf(this, OidcError.prototype);
	}
}

export class ProtocolError extends Error {
	readonly category: FailureCategory = 'Protocol';
	readonly recoverable = false;

	constructor(message: string) {
		super(message);
		this.name = 'ProtocolError';
		Object.setPrototypeOf(this, ProtocolError.prototype);
	}
}

export class ConfigurationError extends Error {
	readonly category: FailureCategory = 'InvalidRequest';
	readonly recoverable = false;

	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
		Object.setPrototypeOf(this, ConfigurationError.prototype);
	}
}

export class InternalError extends Error {
	readonly category: FailureCategory = 'Internal';
	readonly recoverable = false;

	constructor(message: string) {
		super(message);
		this.name = 'InternalError';
		Object.setPrototypeOf(this, InternalError.prototype);
	}
}

/**
 * Throws the appropriate structured error for a non-OK token/revocation endpoint response:
 * `ServerError` for 5xx/429, `OidcError` for a well-formed `{error, ...}` body, `ProtocolError` otherwise.
 *
 * @param {Object} response - The non-OK HTTP response from a token/revocation endpoint.
 * @throws {ServerError | OidcError | ProtocolError} Always throws.
 */
export async function throwTokenEndpointError(response: { status: number; json: () => Promise<Record<string, string>> }): Promise<never> {
	if (response.status === 429 || response.status >= 500) {
		throw new ServerError(`Token endpoint returned HTTP ${response.status}`, response.status);
	}

	let body: Record<string, string>;

	try {
		body = await response.json();
	} catch {
		throw new ProtocolError(`Non-JSON error response from token endpoint`);
	}

	if (typeof body.error !== 'string') {
		throw new ProtocolError(`Malformed error response from token endpoint`);
	}

	throw new OidcError(body.error, body.error_description, body.error_uri);
}

/**
 * Throws the appropriate structured error for a non-OK HTTP response that has no OAuth-style `{error, ...}` body:
 * `ServerError` for 5xx/429, `ProtocolError` otherwise.
 *
 * @param {number} status - The HTTP status code of the failed response.
 * @param {string} message - The error message to use.
 * @throws {ServerError | ProtocolError} Always throws.
 */
export function throwHttpError(status: number, message: string): never {
	if (status === 429 || status >= 500) {
		throw new ServerError(message, status);
	}

	throw new ProtocolError(message);
}
