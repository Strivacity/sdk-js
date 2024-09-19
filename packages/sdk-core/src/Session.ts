import type { IdTokenClaims } from './types';
import { timestamp } from './utils/date';

/**
 * Class representing a user's authentication session, storing tokens and related information.
 */
export class Session {
	/**
	 * The state parameter used in the authentication request.
	 * @type {string | null}
	 */
	state: string | null = null;

	/**
	 * The authorization code returned by the authorization server.
	 * @type {string | null}
	 */
	code: string | null = null;

	/**
	 * The error returned during the authentication process, if any.
	 * @type {string | null}
	 */
	error: string | null = null;

	/**
	 * A description of the error returned during authentication.
	 * @type {string | null}
	 */
	error_description: string | null = null;

	/**
	 * The ID token issued by the authorization server.
	 * @type {string | null}
	 */
	id_token: string | null = null;

	/**
	 * The access token issued by the authorization server.
	 * @type {string | null}
	 */
	access_token: string | null = null;

	/**
	 * The refresh token issued by the authorization server.
	 * @type {string | null}
	 */
	refresh_token: string | null = null;

	/**
	 * The type of token issued, defaulting to 'bearer'.
	 * @type {string}
	 */
	token_type = 'bearer';

	/**
	 * The scope of the issued token.
	 * @type {string | null}
	 */
	scope: string | null = null;

	/**
	 * The expiration timestamp of the access token, represented in seconds since the epoch.
	 * @type {number | null}
	 */
	expires_at: number | null = null;

	/**
	 * The claims associated with the ID token.
	 * @type {IdTokenClaims | null}
	 */
	claims: IdTokenClaims | null = null;

	/**
	 * Returns the number of seconds until the access token expires.
	 * If `expires_at` is not set, returns 0.
	 *
	 * @returns {number} The number of seconds until the token expires.
	 */
	get expires_in(): number {
		if (!this.expires_at) {
			return 0;
		}

		return this.expires_at - timestamp();
	}

	/**
	 * Sets the expiration time based on a duration in seconds.
	 * This also updates the `expires_at` timestamp.
	 *
	 * @param {number | null} value The number of seconds until the token expires.
	 */
	set expires_in(value: number | null) {
		if (value !== null && !isNaN(value)) {
			this.expires_at = Math.floor(value) + timestamp();
		}
	}

	/**
	 * Loads a serialized session from a JSON string.
	 *
	 * @param {string | null} serializedSession The JSON string representing a session.
	 * @returns {Session | null} A new session instance populated with the data from the string, or null if parsing fails.
	 */
	static load(serializedSession: string | null): Session | null {
		if (!serializedSession) {
			return null;
		}

		let session: Session | null = new Session();

		try {
			Object.assign(session, JSON.parse(serializedSession));
		} catch {
			session = null;
		}

		return session;
	}
}
