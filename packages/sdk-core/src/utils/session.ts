import type { SessionData } from '../types/oidc';
import { timestamp } from './common';

/**
 * Creates a new session object with default values and merges it with provided parameters.
 *
 * @param params - An object containing session parameters to merge with the default session.
 * @returns A new session object with merged values.
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

	if (typeof params.expires_in === 'number' && !isNaN(params.expires_in as number)) {
		session.expires_at = Math.floor(params.expires_in as number) + timestamp();
	}

	return Object.assign(session, params);
}

/**
 * Loads a serialized session from a JSON string.
 *
 * @param serialized - The serialized session string.
 * @returns The deserialized session object or null if parsing fails.
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
 * @param session - The session object to serialize.
 * @returns The serialized session string.
 */
export function serializeSession(session: SessionData): string {
	return JSON.stringify(session);
}

/**
 * Checks if a session is expired based on its access token and expiration timestamp.
 *
 * @param session - The session object to check.
 * @returns True if the session is expired, false otherwise.
 */
export function isSessionExpired(session?: Partial<SessionData> | null): boolean {
	return !session?.access_token || !session.expires_at || session.expires_at <= timestamp();
}
