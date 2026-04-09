import type { ExtraRequestArgs, IdTokenClaims, SDKOptions } from '@strivacity/sdk-core';
import { jwt } from '@strivacity/sdk-core/utils/jwt';
import { Session } from '@strivacity/sdk-core/utils/Session';
import { State } from '@strivacity/sdk-core/utils/State';

export class OAuthError extends Error {
	constructor(
		public readonly error: string,
		public readonly error_description: string,
	) {
		super(`${error}: ${error_description}`);
		this.name = 'OAuthError';
	}
}

export const options: SDKOptions = {
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
};
export let metadata = await fetchMetadata();
export let storage = new Map<string, string>();

export async function fetchMetadata() {
	const response = await fetch(new URL('/.well-known/openid-configuration', options.issuer).toString());

	if (!response.ok) {
		const error = new Error(`Failed to fetch metadata with status ${response.status}`);
		throw error;
	}

	return await response.json();
}

export async function getAuthorizationUrl(params: ExtraRequestArgs = {}): Promise<URL> {
	const url = new URL(metadata.authorization_endpoint);

	url.searchParams.append('client_id', options.clientId);
	url.searchParams.append('redirect_uri', options.redirectUri);
	url.searchParams.append('response_type', 'code');
	url.searchParams.append('response_mode', 'query');
	url.searchParams.append('scope', options.scopes?.join(' ') || '');
	url.searchParams.append('code_challenge_method', 'S256');
	url.searchParams.append('sdk', 'web');

	if (params.prompt) {
		url.searchParams.append('prompt', params.prompt);
	}
	if (params.acrValues?.length) {
		url.searchParams.append('acr_values', params.acrValues.join(' '));
	}
	if (params.loginHint?.length) {
		url.searchParams.append('login_hint', params.loginHint);
	}
	if (params.uiLocales?.length) {
		url.searchParams.append('ui_locales', params.uiLocales.join(' '));
	}
	if (params.audiences?.length) {
		url.searchParams.append('audience', params.audiences.join(' '));
	}

	return url;
}

export async function sendTokenRequest(url: string, data: Record<string, string> = {}): Promise<Response> {
	return fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(data).toString(),
	}) as Promise<Response>;
}

export async function startSession(params: ExtraRequestArgs = {}) {
	console.log('Starting login flow session');

	const state = await State.create();
	const authorizationUrl = await getAuthorizationUrl(params);

	authorizationUrl.searchParams.append('state', state.id);
	authorizationUrl.searchParams.append('code_challenge', state.codeChallenge);
	authorizationUrl.searchParams.append('nonce', state.nonce);

	const response = await fetch(authorizationUrl.toString(), {
		method: 'GET',
		credentials: 'include',
	});

	if (!response.ok) {
		const error = new Error(`Authorization request failed with status ${response.status}`);
		console.error('Authorization request error', error);
		throw error;
	}

	let uri: URL;

	try {
		uri = new URL(await response.text());
	} catch {
		uri = new URL(response.url);
	}

	if (uri.searchParams.has('error')) {
		const error = new Error(`${uri.searchParams.get('error')}: ${uri.searchParams.get('error_description')}`);
		console.error('Authorization error', error);
		throw error;
	}

	if (!uri.searchParams.has('session_id')) {
		const error = new Error('"session_id" is missing from the response');
		console.error('Failed to start a session', error);
		throw error;
	}

	const sessionId = uri.searchParams.get('session_id') as string;
	const shortAppId = uri.searchParams.get('short_app_id') as string;

	storage.set(`session.${sessionId}`, JSON.stringify(state));

	return { session_id: sessionId, short_app_id: shortAppId };
}

export async function refreshSession(sessionId: string) {
	const session = Session.load(storage.get(sessionId) ?? null);

	if (!session) {
		const error = new Error('Session not found');
		console.error('Session refresh failed', error);
		throw error;
	}

	const response = await sendTokenRequest(metadata.token_endpoint, {
		grant_type: 'refresh_token',
		client_id: options.clientId,
		refresh_token: session?.refresh_token as string,
	});

	if (!response.ok) {
		const data = await response.json();
		const error = new OAuthError(data.error, data.error_description);
		console.error('Token exchange failed', error);
		throw error;
	}

	Object.assign(session, await response.json());

	if (session.id_token) {
		session.claims = jwt.decode<IdTokenClaims>(session.id_token);
	}
}

export async function revokeSession(sessionId: string) {
	const session = Session.load(storage.get(sessionId) ?? null);
	let response: Response | undefined;

	if (session?.refresh_token) {
		console.log('Attempting to revoke refresh token');

		response = await sendTokenRequest(metadata.revocation_endpoint, {
			client_id: options.clientId,
			token_type_hint: 'refresh_token',
			token: session.refresh_token,
		});
	} else if (session?.access_token) {
		console.log('Attempting to revoke access token');

		response = await sendTokenRequest(metadata.revocation_endpoint, {
			client_id: options.clientId,
			token_type_hint: 'access_token',
			token: session.access_token,
		});
	}

	if (response && !response.ok) {
		const data = await response.json();
		throw new OAuthError(data.error, data.error_description);
	}
}

export function getLogoutUrl(sessionId: string) {
	const session = Session.load(storage.get(sessionId) ?? null);

	storage.delete(sessionId);

	const url = new URL(metadata.end_session_endpoint);

	url.searchParams.append('id_token_hint', session?.id_token as string);

	return url;
}

export async function entrySession(params: Record<string, string> = {}) {
	params.sdk = 'web';
	params.client_id = options.clientId;
	params.redirect_uri = options.redirectUri;

	const response = await fetch(`${options.issuer}/provider/flow/entry?${new URLSearchParams(params).toString()}`);

	if (!response.ok) {
		if (response.status === 400) {
			const data = await response.json();
			let message = 'Entry request failed with status 400';

			if (typeof data === 'object') {
				if (data.error) {
					message = `${data.error}: ${data.error_description}`;
				} else if (data.errorKey) {
					message = data.errorKey;
				}
			}

			const error = new Error(message);
			console.error('Entry request error', error);
			throw error;
		}

		const error = new Error(`Entry request failed with status ${response.status}`);
		console.error('Entry request error', error);
		throw error;
	}

	let uri: URL;

	try {
		uri = new URL(await response.text());
	} catch {
		uri = new URL(response.url);
	}

	const sessionId = uri.searchParams.get('session_id');
	const shortAppId = uri.searchParams.get('short_app_id') as string;

	if (!sessionId) {
		const error = new Error('Session ID not found in entry response');
		console.error('Entry response error', error);
		throw error;
	}

	return { session_id: sessionId, short_app_id: shortAppId };
}

export async function finalizeSession(sessionId?: string, params: Record<string, string> = {}) {
	console.log('Exchanging authorization code for tokens');

	const session = new Session();

	Object.assign(session, params);

	if (session.error) {
		const error = new OAuthError(session.error, session.error_description ?? '');
		console.error('Authorization error', error);
		throw error;
	}
	if (!session.code) {
		const error = new Error('Invalid or missing code');
		console.error('Authorization error', error);
		throw error;
	}

	console.log(`Authorization code received: ${session.code}`);

	let state: State;

	try {
		const serializedState = storage.get(`session.${sessionId}`) ?? null;

		if (!serializedState) {
			throw new Error();
		}

		state = State.fromSerializedData(serializedState);

		storage.delete(`session.${sessionId}`);
	} catch {
		const error = new Error('Invalid or missing state');
		console.error('Validation failed', error);
		throw error;
	}

	const response = await sendTokenRequest(metadata.token_endpoint, {
		grant_type: 'authorization_code',
		client_id: options.clientId,
		redirect_uri: options.redirectUri,
		code_verifier: state.codeVerifier,
		code: session.code,
	});

	if (!response.ok) {
		const data = await response.json();
		const error = new OAuthError(data.error, data.error_description);
		console.error('Token exchange failed', error);
		throw error;
	}

	Object.assign(session, await response.json());

	console.log(`Tokens received from authorization server:`);
	console.log(`  id_token:      ${session.id_token ?? '(none)'}`);
	console.log(`  access_token:  ${session.access_token ?? '(none)'}`);
	console.log(`  refresh_token: ${session.refresh_token ?? '(none)'}`);

	if (session.id_token) {
		session.claims = jwt.decode<IdTokenClaims>(session.id_token);
	}

	if (session.error) {
		const error = new OAuthError(session.error, session.error_description ?? '');
		console.error('Validation failed', error);
		throw error;
	}
	if (session.scope !== options.scopes?.join(' ')) {
		const error = new Error('Invalid scope');
		console.error('Validation failed', error);
		throw error;
	}
	if (session.claims?.nonce !== state.nonce) {
		const error = new Error('Invalid nonce');
		console.error('Validation failed', error);
		throw error;
	}
	if (session.claims?.iss !== metadata.issuer) {
		const error = new Error('Invalid iss');
		console.error('Validation failed', error);
		throw error;
	}
	if (Array.isArray(session.claims?.aud) ? session.claims?.aud[0] !== options.clientId : session.claims?.aud !== options.clientId) {
		const error = new Error('Invalid aud');
		console.error('Validation failed', error);
		throw error;
	}

	const id = crypto.randomUUID();

	storage.set(id, JSON.stringify(session));

	return id;
}
