import type { LogoutTokenClaims } from '@strivacity/sdk-core/types';
import { defineEventHandler } from 'h3';
import { verifyJwt } from '@strivacity/sdk-core/utils/oidc';
import { BACKCHANNEL_LOGOUT_EVENT } from '../../utils/helpers';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	if (typeof options.storage.deleteByLogoutToken !== 'function') {
		return new Response('Back-channel logout requires a storage with deleteByLogoutToken', { status: 501 });
	}

	let logoutToken;

	try {
		const contentType = event.req.headers.get('content-type') ?? '';

		if (contentType.includes('application/x-www-form-urlencoded')) {
			const body = await event.req.formData();
			logoutToken = body.get('logout_token') as string | null;
		} else {
			return new Response('Invalid content type: expected application/x-www-form-urlencoded', { status: 400 });
		}
	} catch {
		return new Response('Failed to parse request body', { status: 400 });
	}

	if (!logoutToken) {
		return new Response('Missing logout_token', { status: 400 });
	}

	let claims: LogoutTokenClaims;

	try {
		claims = await verifyJwt<LogoutTokenClaims>(logoutToken, (await options.getMetadata()).jwks_uri);
	} catch (error) {
		return new Response(`Invalid logout_token: ${error instanceof Error ? error.message : 'verification failed'}`, { status: 400 });
	}

	if (claims.nonce !== undefined) {
		return new Response('Invalid logout_token: nonce claim must not be present', { status: 400 });
	}

	if (!claims.events || !(BACKCHANNEL_LOGOUT_EVENT in claims.events)) {
		return new Response(`Invalid logout_token: missing ${BACKCHANNEL_LOGOUT_EVENT} in events`, { status: 400 });
	}

	if (!claims.sid && !claims.sub) {
		return new Response('Invalid logout_token: must contain sid or sub claim', { status: 400 });
	}

	const token: LogoutTokenClaims = {};

	if (claims.sid) {
		token.sid = claims.sid;
	}
	if (claims.sub) {
		token.sub = claims.sub;
	}

	try {
		await options.storage.deleteByLogoutToken?.(token);
	} catch (error) {
		return new Response(`Failed to delete session: ${error instanceof Error ? error.message : 'unknown error'}`, { status: 500 });
	}

	return new Response(null, { status: 200 });
});
