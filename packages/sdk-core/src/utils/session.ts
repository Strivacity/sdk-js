import type { SessionData } from '../types/oidc';
import { ProtocolError } from './errors';
import { timestamp } from './common';

/**
 * Creates a new session object with default values and merges it with provided parameters.
 *
 * @param {Record<string, unknown>} params - Optional parameters to merge into the new session object.
 * @returns {SessionData} The newly created session object.
 */
export function createSession(params: Record<string, unknown> = {}): SessionData {
	const session: SessionData = {
		state: null,
		code: null,
		error: null,
		error_description: null,
		id_token: null,
		access_token: null,
		refresh_token: null,
		token_type: 'bearer',
		scope: null,
		expires_in: null,
		expires_at: null,
		claims: null,
	};

	if (typeof params.expires_in === 'number' && !isNaN(params.expires_in)) {
		session.expires_at = Math.floor(params.expires_in) + timestamp();
	}

	Object.assign(session, params);

	if (session.access_token && session.token_type?.toLowerCase() !== 'bearer') {
		throw new ProtocolError(`Unsupported token_type: ${session.token_type}`);
	}

	return session;
}

/**
 * Loads a serialized session from a JSON string.
 *
 * @param {string | null} serialized - The serialized session string to parse.
 * @returns {SessionData | null} The parsed session object, or null if parsing fails.
 */
export function loadSession(serialized: string | null): SessionData | null {
	if (!serialized) {
		return null;
	}

	let session: SessionData | null = createSession();

	try {
		Object.assign(session, JSON.parse(serialized));
	} catch {
		session = null;
	}

	return session;
}

/**
 * Serializes a session object into a JSON string.
 *
 * @param {SessionData} session - The session object to serialize.
 * @returns {string} The serialized session string.
 */
export function serializeSession(session: SessionData): string {
	return JSON.stringify(session);
}

/**
 * Checks if a session is expired based on its access token and expiration timestamp.
 *
 * @param {Partial<SessionData> | null} session - The session object to check for expiration.
 * @returns {boolean} True if the session is expired or invalid, false otherwise.
 */
export function isSessionExpired(session?: Partial<SessionData> | null): boolean {
	return !session?.access_token || !session.expires_at || session.expires_at <= timestamp();
}
