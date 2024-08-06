import type { IdTokenClaims } from './types';
import { timestamp } from './utils/date';

export class Session {
	state: string | null = null;
	code: string | null = null;
	error: string | null = null;
	error_description: string | null = null;

	id_token: string | null = null;
	access_token: string | null = null;
	refresh_token: string | null = null;
	token_type = 'bearer';
	scope: string | null = null;
	expires_at: number | null = null;

	claims: IdTokenClaims | null = null;

	get expires_in(): number {
		if (!this.expires_at) {
			return 0;
		}

		return this.expires_at - timestamp();
	}

	set expires_in(value: number | null) {
		if (value !== null && !isNaN(value)) {
			this.expires_at = Math.floor(value) + timestamp();
		}
	}

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
