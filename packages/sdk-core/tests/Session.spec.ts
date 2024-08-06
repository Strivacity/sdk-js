import { describe, it, expect } from 'vitest';
import { Session } from '../src/Session';
import { timestamp } from '../src/utils/date';

describe('Session', () => {
	it('load', async () => {
		const serializedSession: Session = {
			state: 'state',
			code: 'code',
			error: null,
			error_description: null,
			id_token: 'id_token',
			access_token: 'access_token',
			refresh_token: 'refresh_token',
			token_type: 'bearer',
			scope: 'openid profile',
			expires_in: 0,
			expires_at: timestamp(),
			claims: {
				iss: 'https://brandtegrity.io/',
				aud: ['2202c596c06e4774b42804a106c66dff'],
				sub: 'fbf8d33c-0eb2-4e86-a2f3-f67334804312',
				exp: 1723796396,
				iat: 1723792796,
			},
		};
		const session = Session.load(JSON.stringify(serializedSession));

		expect(session?.state).toEqual(serializedSession.state);
		expect(session?.code).toEqual(serializedSession.code);
		expect(session?.error).toEqual(serializedSession.error);
		expect(session?.error_description).toEqual(serializedSession.error_description);
		expect(session?.id_token).toEqual(serializedSession.id_token);
		expect(session?.access_token).toEqual(serializedSession.access_token);
		expect(session?.refresh_token).toEqual(serializedSession.refresh_token);
		expect(session?.token_type).toEqual(serializedSession.token_type);
		expect(session?.scope).toEqual(serializedSession.scope);
		expect(session?.expires_in).toEqual(serializedSession.expires_in);
		expect(session?.expires_at).toEqual(serializedSession.expires_at);
		expect(session?.claims).toEqual(serializedSession.claims);
	});

	it('should set expires_at correctly', () => {
		const session = new Session();

		session.expires_in = 3600;

		expect(session.expires_at).toEqual(timestamp() + 3600);

		session.expires_at = null;

		expect(session.expires_in).toEqual(0);

		// @ts-expect-error: Set invalid value
		session.expires_in = 'invalid';

		expect(session.expires_at).toEqual(null);
	});

	it('should handle parsing error on load', () => {
		const session = Session.load('invalid');

		expect(session).toBeNull();
	});
});
