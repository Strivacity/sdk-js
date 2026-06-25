import { describe, test, expect, beforeAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
	createSessionData,
	createMockEvent,
	createMockStorage,
	createServerOptions,
	createServerSDK,
	createServerMockStorage,
	getPostLogoutTokenRequest,
	seedState,
	serverAdapter,
	type MockEvent,
} from '@strivacity/testing/mocks/sdk';
import { worker } from '@strivacity/testing/mocks/msw';
import { buildLogoutTokenClaims, exportSigningKey, generateRSAKeyPair, signLogoutToken } from '@strivacity/testing/mocks/oidc';
import type { ServerAdapter } from '../../../src/types';
import { BACKCHANNEL_LOGOUT_EVENT, timestamp, ConfigurationError, ProtocolError, serializeSession } from '../../../src/utils';
import { createBaseServerSDK } from '../../../src/server/base';

describe('createBaseServerSDK', () => {
	describe('init', () => {
		test.each([
			['issuer', { issuer: '' }, 'Missing option: issuer'],
			['clientId', { clientId: '' }, 'Missing option: clientId'],
			[
				'redirectUri',
				{ redirectUri: '', postLoginRedirectUri: 'https://brandtegrity.io', postLogoutRedirectUri: 'https://brandtegrity.io' },
				'Missing option: redirectUri',
			],
		])('should throw a ConfigurationError when %s is missing', (_name, overrides, message) => {
			const options = createServerOptions(overrides);

			expect(() => createBaseServerSDK(serverAdapter, options)).toThrow(new ConfigurationError(message));
			expect(options.logging?.error).toHaveBeenCalledWith('Required option missing', expect.any(ConfigurationError));
		});

		test('should throw a ConfigurationError when scopes is not an array', () => {
			const options = createServerOptions({ scopes: 'openid' as unknown as Array<string> });

			expect(() => createBaseServerSDK(serverAdapter, options)).toThrow(new ConfigurationError('Invalid option: scopes'));
			expect(options.logging?.error).toHaveBeenCalledWith('Invalid option provided', expect.any(ConfigurationError));
		});
	});

	describe('getSession', () => {
		test('should return null when there is no session', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.getSession(createMockEvent())).resolves.toBeNull();
		});

		test('should return the persisted session', async () => {
			const { sdk, storage, options } = createServerSDK();
			const session = createSessionData();
			await storage.set(options.storageTokenName, serializeSession(session));

			await expect(sdk.getSession(createMockEvent())).resolves.toEqual(session);
		});
	});

	describe('updateSession', () => {
		test('should persist the session to storage', async () => {
			const { sdk } = createServerSDK();
			const session = createSessionData();

			await sdk.updateSession(session, createMockEvent());

			await expect(sdk.getSession(createMockEvent())).resolves.toEqual(session);
		});
	});

	describe('refreshSession', () => {
		test('should refresh the session and persist the new tokens', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ refresh_token: 'old-refresh-token' })));

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			const refreshed = await sdk.refreshSession(createMockEvent());

			expect(refreshed.access_token).toBe('new-access-token');
			await expect(sdk.getSession(createMockEvent())).resolves.toEqual(refreshed);
		});

		test('should throw a ProtocolError when there is no session', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.refreshSession(createMockEvent())).rejects.toThrow(new ProtocolError('No session available to refresh'));
		});

		test('should throw a ConfigurationError when there is no refresh token', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ refresh_token: null })));

			await expect(sdk.refreshSession(createMockEvent())).rejects.toThrow(new ConfigurationError('No refresh token available'));
		});

		test('should clean up the session on failure', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData()));

			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => new HttpResponse(null, { status: 400 })));

			await expect(sdk.refreshSession(createMockEvent())).rejects.toThrow();
			await expect(sdk.getSession(createMockEvent())).resolves.toBeNull();
		});
	});

	describe('revokeSession', () => {
		test('should revoke the refresh token and clear the session', async () => {
			const { sdk, storage, options } = createServerSDK();
			const session = createSessionData();
			await storage.set(options.storageTokenName, serializeSession(session));
			let revokedTokenTypeHint: string | null = null;

			worker.use(
				http.post('https://brandtegrity.io/oauth2/revoke', async ({ request }) => {
					revokedTokenTypeHint = new URLSearchParams(await request.text()).get('token_type_hint');
					return HttpResponse.json({});
				}),
			);

			await sdk.revokeSession(createMockEvent());

			expect(revokedTokenTypeHint).toBe('refresh_token');
			await expect(sdk.getSession(createMockEvent())).resolves.toBeNull();
		});

		test('should revoke the access token when there is no refresh token', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ refresh_token: null })));
			let revokedTokenTypeHint: string | null = null;

			worker.use(
				http.post('https://brandtegrity.io/oauth2/revoke', async ({ request }) => {
					revokedTokenTypeHint = new URLSearchParams(await request.text()).get('token_type_hint');
					return HttpResponse.json({});
				}),
			);

			await sdk.revokeSession(createMockEvent());

			expect(revokedTokenTypeHint).toBe('access_token');
		});

		test('should be a no-op when there is no session', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.revokeSession(createMockEvent())).resolves.toBeUndefined();
		});

		test('should rethrow on failure', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData()));

			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => new HttpResponse(null, { status: 400 })));

			await expect(sdk.revokeSession(createMockEvent())).rejects.toThrow();
		});
	});

	describe('getEntrySession', () => {
		test('should fetch the entry data', async () => {
			const { sdk } = createServerSDK();

			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', () =>
					HttpResponse.text('https://brandtegrity.io/entry?session_id=abc123&short_app_id=app&language=hu-HU'),
				),
			);

			await expect(sdk.getEntrySession('https://brandtegrity.io/entry?challenge=abc123')).resolves.toEqual({
				session_id: 'abc123',
				short_app_id: 'app',
				language: 'hu-HU',
			});
		});

		test('should use web-embedded as the sdk mode for embedded mode', async () => {
			const { sdk } = createServerSDK({ mode: 'embedded' });
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', ({ request }) => {
					capturedUrl = new URL(request.url);
					return HttpResponse.text('https://brandtegrity.io/entry?session_id=abc123&short_app_id=app&language=hu-HU');
				}),
			);

			await sdk.getEntrySession('https://brandtegrity.io/entry');

			expect(capturedUrl?.searchParams.get('sdk')).toBe('web-embedded');
		});
	});

	describe('completeLogin', () => {
		test('should exchange the code for tokens and persist the session', async () => {
			const { sdk, stateStorage } = createServerSDK();
			const stateData = await seedState(stateStorage);

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			const event = createMockEvent();
			const session = await sdk.completeLogin({ code: 'abc123', state: stateData.id }, event);

			expect(session.access_token).toBe('access-token');
			await expect(sdk.getSession(event)).resolves.toEqual(session);
		});

		test('should reject when the response is missing an access_token', async () => {
			const { sdk, stateStorage } = createServerSDK();
			const stateData = await seedState(stateStorage);

			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ token_type: 'Bearer', expires_in: 3600 })));

			await expect(sdk.completeLogin({ code: 'abc123', state: stateData.id })).rejects.toThrow(new ProtocolError('Missing access_token'));
		});
	});

	describe('logout', () => {
		test('should clear the session and return the end-session url', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ id_token: 'id-token' })));

			const url = await sdk.logout('https://brandtegrity.io/bye', createMockEvent());

			expect(`${url.origin}${url.pathname}`).toBe('https://brandtegrity.io/oauth2/sessions/logout');
			expect(url.searchParams.get('id_token_hint')).toBe('id-token');
			expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://brandtegrity.io/bye');
			await expect(sdk.getSession(createMockEvent())).resolves.toBeNull();
		});

		test('should return the postLogoutRedirectUri unchanged when there is no id token', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ id_token: null })));

			const url = await sdk.logout('https://brandtegrity.io/bye', createMockEvent());

			expect(url.toString()).toBe('https://brandtegrity.io/bye');
			await expect(sdk.getSession(createMockEvent())).resolves.toBeNull();
		});
	});

	describe('redirect', () => {
		test('uses the adapter-provided redirect override when available', async () => {
			const customRedirect = vi.fn(
				(url: string | URL, status: number) => new Response(null, { status, headers: { 'x-custom-redirect': 'true', location: url.toString() } }),
			);
			const customServerAdapter: ServerAdapter<MockEvent> = { toRequest: (event) => event.request, redirect: customRedirect };
			const storage = createMockStorage();
			const initOptions = createServerOptions({ storage, stateStorage: createMockStorage() });
			const sdk = createBaseServerSDK(customServerAdapter, initOptions);
			await storage.set(sdk.options.storageTokenName, serializeSession(createSessionData()));

			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));

			const response = await sdk.handleRevoke(createMockEvent());

			expect(customRedirect).toHaveBeenCalledWith(expect.any(URL), 302, expect.anything());
			expect(response.headers.get('x-custom-redirect')).toBe('true');
		});

		test('falls back to a plain Response with a Location header when the adapter has no override', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData()));

			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));

			const response = await sdk.handleRevoke(createMockEvent());

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe(new URL(options.postLogoutRedirectUri).toString());
		});
	});

	describe('handleLogin', () => {
		test('should build the authorization URL, proxy the IDP redirect response, and set the returnTo cookie', async () => {
			const { sdk } = createServerSDK();
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
					capturedUrl = new URL(request.url);
					return new HttpResponse(null, { status: 302, headers: { location: 'https://brandtegrity.io/hosted-login' } });
				}),
			);

			const response = await sdk.handleLogin(createMockEvent('https://brandtegrity.io/auth/login?returnTo=/dashboard&loginHint=user@example.com'));

			expect(capturedUrl?.searchParams.get('login_hint')).toBe('user@example.com');
			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('https://brandtegrity.io/hosted-login');

			const returnToCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith('sty.returnTo='));

			expect(decodeURIComponent(returnToCookie!.split(';')[0].split('=')[1])).toBe('https://brandtegrity.io/dashboard');
		});

		test('should forward the sdk query param to the IDP request in embedded mode', async () => {
			const { sdk } = createServerSDK({ mode: 'embedded' });
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
					capturedUrl = new URL(request.url);
					return new HttpResponse(null, { status: 302, headers: { location: 'https://brandtegrity.io/hosted-login' } });
				}),
			);

			await sdk.handleLogin(createMockEvent('https://brandtegrity.io/auth/login?sdk=web-embedded'));

			expect(capturedUrl?.searchParams.get('sdk')).toBe('web-embedded');
		});

		test('should reject (not redirect to /error) when returnTo points to a different origin', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.handleLogin(createMockEvent('https://brandtegrity.io/auth/login?returnTo=https://evil.example.com'))).rejects.toThrow(
				/Invalid returnTo URL/,
			);
		});
	});

	describe('handleRegister', () => {
		test('should force the create prompt', async () => {
			const { sdk } = createServerSDK();
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
					capturedUrl = new URL(request.url);
					return new HttpResponse(null, { status: 302, headers: { location: 'https://brandtegrity.io/hosted-login' } });
				}),
			);

			await sdk.handleRegister(createMockEvent('https://brandtegrity.io/auth/register'));

			expect(capturedUrl?.searchParams.get('prompt')).toBe('create');
		});
	});

	describe('handleCallback', () => {
		test('should exchange the code, clear the returnTo cookie, and redirect to it', async () => {
			const { sdk, stateStorage } = createServerSDK();
			const stateData = await seedState(stateStorage);

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			const response = await sdk.handleCallback({
				request: (() => {
					const request = new Request(`https://brandtegrity.io/auth/callback?code=abc123&state=${stateData.id}`);
					// NOTE: `Request`'s constructor strips forbidden headers like `cookie`, so it must be set directly on the built request instead.
					request.headers.set('cookie', `sty.returnTo=${encodeURIComponent('https://brandtegrity.io/dashboard')}`);
					return request;
				})(),
			});

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('https://brandtegrity.io/dashboard');

			const clearedCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith('sty.returnTo='));

			expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970');
		});

		test('should redirect to postLoginRedirectUri when there is no returnTo cookie', async () => {
			const { sdk, stateStorage, options } = createServerSDK();
			const stateData = await seedState(stateStorage);

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			const response = await sdk.handleCallback(createMockEvent(`https://brandtegrity.io/auth/callback?code=abc123&state=${stateData.id}`));

			expect(response.headers.get('location')).toBe(new URL(options.postLoginRedirectUri).toString());
		});

		test('should return a popup-closing HTML response when the login was initiated from a popup', async () => {
			const { sdk, stateStorage } = createServerSDK();
			const stateData = await seedState(stateStorage, { metadata: { display: 'popup' } });

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			const response = await sdk.handleCallback(createMockEvent(`https://brandtegrity.io/auth/callback?code=abc123&state=${stateData.id}`));

			expect(response.headers.get('content-type')).toContain('text/html');
			await expect(response.text()).resolves.toContain('window.close()');
		});

		test('should redirect to /error when the state is missing', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handleCallback(createMockEvent('https://brandtegrity.io/auth/callback?code=abc123&state=missing'));

			expect(response.status).toBe(302);
			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe('https://brandtegrity.io/error');
			expect(location.searchParams.get('type')).toBe('protocol');
			expect(location.searchParams.get('error')).toBe('ProtocolError');
			expect(location.searchParams.get('error_description')).toBe('State not found or expired. Please try logging in again.');
		});

		test('should redirect to /error with the OIDC error when the token exchange fails', async () => {
			const { sdk, stateStorage } = createServerSDK();
			const stateData = await seedState(stateStorage);

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ error: 'invalid_grant', error_description: 'Code expired' }, { status: 400 }),
				),
			);

			const response = await sdk.handleCallback(createMockEvent(`https://brandtegrity.io/auth/callback?code=abc123&state=${stateData.id}`));

			const location = new URL(response.headers.get('location') as string);

			expect(location.searchParams.get('type')).toBe('oidc');
			expect(location.searchParams.get('error')).toBe('invalid_grant');
			expect(location.searchParams.get('error_description')).toBe('Code expired');
		});
	});

	describe('handleRefresh', () => {
		test('should refresh the session and return 204 when there is no returnTo', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData()));

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			const response = await sdk.handleRefresh(createMockEvent('https://brandtegrity.io/auth/refresh'));

			expect(response.status).toBe(204);
		});

		test('should redirect to a safe returnTo after refreshing', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData()));
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			const response = await sdk.handleRefresh(createMockEvent('https://brandtegrity.io/auth/refresh?returnTo=/dashboard'));

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('https://brandtegrity.io/dashboard');
		});

		test('should reject (not redirect to /error) when returnTo points to a different origin', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.handleRefresh(createMockEvent('https://brandtegrity.io/auth/refresh?returnTo=https://evil.example.com'))).rejects.toThrow(
				/Invalid returnTo URL/,
			);
		});

		test('should redirect to /error when there is no session to refresh', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handleRefresh(createMockEvent('https://brandtegrity.io/auth/refresh'));

			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe('https://brandtegrity.io/error');
			expect(location.searchParams.get('error_description')).toBe('No session available to refresh');
		});
	});

	describe('handleRevoke', () => {
		test('should revoke the session and redirect to postLogoutRedirectUri', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData()));

			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));

			const response = await sdk.handleRevoke(createMockEvent('https://brandtegrity.io/auth/revoke'));

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe(new URL(options.postLogoutRedirectUri).toString());
		});

		test('should redirect to /error with an "unknown" shape when a non-Error value is thrown', async () => {
			const { sdk, storage } = createServerSDK();
			vi.spyOn(storage, 'get').mockRejectedValueOnce('boom');

			const response = await sdk.handleRevoke(createMockEvent('https://brandtegrity.io/auth/revoke'));

			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe('https://brandtegrity.io/error');
			expect(location.searchParams.get('type')).toBe('unknown');
			expect(location.searchParams.get('error')).toBe('unknown_error');
			expect(location.searchParams.get('error_description')).toBe('Unknown error');
		});
	});

	describe('handleEntry', () => {
		test('should redirect to the login page with the entry session data', async () => {
			const { sdk, options } = createServerSDK();

			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', () =>
					HttpResponse.text('https://brandtegrity.io/entry?session_id=abc123&short_app_id=app&language=hu-HU'),
				),
			);

			const response = await sdk.handleEntry(createMockEvent('https://brandtegrity.io/auth/entry?challenge=abc123'));

			expect(response.status).toBe(302);
			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe(`https://brandtegrity.io${options.loginUri}`);
			expect(location.searchParams.get('session_id')).toBe('abc123');
			expect(location.searchParams.get('short_app_id')).toBe('app');
			expect(location.searchParams.get('language')).toBe('hu-HU');
		});

		test('should redirect to /error when the entry request fails', async () => {
			const { sdk } = createServerSDK();

			worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => new HttpResponse('{}', { status: 400 })));

			const response = await sdk.handleEntry(createMockEvent('https://brandtegrity.io/auth/entry?challenge=abc123'));

			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe('https://brandtegrity.io/error');
		});
	});

	describe('handleLogout', () => {
		test('should redirect to the end-session URL', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ id_token: 'id-token' })));

			const response = await sdk.handleLogout(createMockEvent('https://brandtegrity.io/auth/logout'));

			expect(response.status).toBe(302);
			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe('https://brandtegrity.io/oauth2/sessions/logout');
			expect(location.searchParams.get('id_token_hint')).toBe('id-token');
		});

		test('should redirect to /error with an "Error without category" shape when cleanup fails', async () => {
			const { sdk, storage, options } = createServerSDK();
			await storage.set(options.storageTokenName, serializeSession(createSessionData({ id_token: 'id-token' })));
			vi.spyOn(storage, 'delete').mockRejectedValueOnce(new Error('storage failure'));

			const response = await sdk.handleLogout(createMockEvent('https://brandtegrity.io/auth/logout'));

			const location = new URL(response.headers.get('location') as string);

			expect(`${location.origin}${location.pathname}`).toBe('https://brandtegrity.io/error');
			expect(location.searchParams.get('type')).toBe('unknown');
			expect(location.searchParams.get('error')).toBe('unknown_error');
			expect(location.searchParams.get('error_description')).toBe('storage failure');
		});
	});

	describe('handleBackChannelLogout', () => {
		let keyPair: CryptoKeyPair;

		function mockJwks(signingKey: unknown): void {
			worker.use(http.get('https://brandtegrity.io/.well-known/jwks.json', () => HttpResponse.json({ keys: [signingKey] })));
		}

		beforeAll(async () => {
			keyPair = await generateRSAKeyPair();
		});

		test('should return 501 when the storage does not support deleteByLogoutToken', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest('token'));

			expect(response.status).toBe(501);
		});

		test('should return 400 for a request that is not form-urlencoded', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });

			const response = await sdk.handleBackChannelLogout({ request: new Request('https://brandtegrity.io/auth/backchannel-logout', { method: 'POST' }) });

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('Invalid content type');
		});

		test('should return 400 when logout_token is missing', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });

			const response = await sdk.handleBackChannelLogout({
				request: new Request('https://brandtegrity.io/auth/backchannel-logout', {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: '',
				}),
			});

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('Missing logout_token');
		});

		test('should return 400 for an unverifiable logout_token', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest('not-a-jwt'));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('Invalid logout_token');
		});

		test('should return 400 when the iss claim does not match', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-iss'));
			const token = await signLogoutToken(buildLogoutTokenClaims({ iss: 'https://impostor.example.com/' }), keyPair.privateKey, 'kid-iss');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('invalid iss claim');
		});

		test('should return 400 when the aud claim does not match', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-aud'));
			const token = await signLogoutToken(buildLogoutTokenClaims({ aud: 'other-client' }), keyPair.privateKey, 'kid-aud');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('invalid aud claim');
		});

		test('should return 400 when the iat claim is missing or stale', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-iat'));
			const token = await signLogoutToken(buildLogoutTokenClaims({ iat: timestamp() - 1000 }), keyPair.privateKey, 'kid-iat');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('invalid or stale iat claim');
		});

		test('should return 400 when the jti claim is missing', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-jti'));
			const claims = buildLogoutTokenClaims();
			delete claims.jti;
			const token = await signLogoutToken(claims, keyPair.privateKey, 'kid-jti');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('missing jti claim');
		});

		test('should return 400 when the nonce claim is present', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-nonce'));
			const token = await signLogoutToken(buildLogoutTokenClaims({ nonce: 'should-not-be-here' }), keyPair.privateKey, 'kid-nonce');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('nonce claim must not be present');
		});

		test('should return 400 when the backchannel-logout event is missing', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-events'));
			const token = await signLogoutToken(buildLogoutTokenClaims({ events: {} }), keyPair.privateKey, 'kid-events');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain(`missing ${BACKCHANNEL_LOGOUT_EVENT} in events`);
		});

		test('should return 400 when neither sid nor sub is present', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-sub-sid'));
			const claims = buildLogoutTokenClaims();
			delete claims.sid;
			const token = await signLogoutToken(claims, keyPair.privateKey, 'kid-sub-sid');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('must contain sid or sub claim');
		});

		test('should delete the session and return 200 for a valid logout_token', async () => {
			const storage = createServerMockStorage();
			const { sdk } = createServerSDK({ storage });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-valid'));
			const token = await signLogoutToken(buildLogoutTokenClaims(), keyPair.privateKey, 'kid-valid');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(200);
			expect(storage.deleteByLogoutToken).toHaveBeenCalledWith({ sid: 'session-id' });
		});

		test('should reject a replayed logout_token', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-replay'));
			const token = await signLogoutToken(buildLogoutTokenClaims({ jti: 'replay-jti' }), keyPair.privateKey, 'kid-replay');

			await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));
			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(400);
			await expect(response.text()).resolves.toContain('token already used');
		});

		test('should return 500 when deleting the session fails', async () => {
			const storage = createServerMockStorage();

			vi.mocked(storage.deleteByLogoutToken).mockRejectedValueOnce(new Error('db down'));
			const { sdk } = createServerSDK({ storage });
			mockJwks(await exportSigningKey(keyPair.publicKey, 'kid-fail'));
			const token = await signLogoutToken(buildLogoutTokenClaims(), keyPair.privateKey, 'kid-fail');

			const response = await sdk.handleBackChannelLogout(getPostLogoutTokenRequest(token));

			expect(response.status).toBe(500);
			await expect(response.text()).resolves.toContain('Failed to delete session: db down');
		});
	});

	describe('handler', () => {
		test('GET /auth/login', async () => {
			const { sdk } = createServerSDK();
			worker.use(
				http.get(
					'https://brandtegrity.io/oauth2/auth',
					() => new HttpResponse(null, { status: 302, headers: { location: 'https://brandtegrity.io/hosted-login' } }),
				),
			);

			const response = await sdk.handler(createMockEvent('https://brandtegrity.io/auth/login'));

			expect(response?.headers.get('location')).toBe('https://brandtegrity.io/hosted-login');
		});

		test('GET /auth/register', async () => {
			const { sdk } = createServerSDK();
			let capturedUrl: URL | undefined;
			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
					capturedUrl = new URL(request.url);
					return new HttpResponse(null, { status: 302, headers: { location: 'https://brandtegrity.io/hosted-login' } });
				}),
			);

			await sdk.handler(createMockEvent('https://brandtegrity.io/auth/register'));

			expect(capturedUrl?.searchParams.get('prompt')).toBe('create');
		});

		test('GET /auth/callback', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handler(createMockEvent('https://brandtegrity.io/auth/callback?code=abc123&state=missing'));

			expect(response?.headers.get('location')).toContain('/error');
		});

		test('GET /auth/refresh', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handler(createMockEvent('https://brandtegrity.io/auth/refresh'));

			expect(response?.headers.get('location')).toContain('/error');
		});

		test('GET /auth/revoke', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handler(createMockEvent('https://brandtegrity.io/auth/revoke'));

			expect(response?.status).toBe(302);
		});

		test('GET /auth/entry', async () => {
			const { sdk } = createServerSDK();
			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', () =>
					HttpResponse.text('https://brandtegrity.io/entry?session_id=abc123&short_app_id=app&language=hu-HU'),
				),
			);

			const response = await sdk.handler(createMockEvent('https://brandtegrity.io/auth/entry'));

			expect(response?.headers.get('location')).toContain(sdk.options.loginUri);
		});

		test('GET /auth/logout', async () => {
			const { sdk } = createServerSDK();

			const response = await sdk.handler(createMockEvent('https://brandtegrity.io/auth/logout'));

			expect(response?.status).toBe(302);
		});

		test('POST /auth/backchannel-logout', async () => {
			const { sdk } = createServerSDK({ storage: createServerMockStorage() });

			const response = await sdk.handler({ request: new Request('https://brandtegrity.io/auth/backchannel-logout', { method: 'POST' }) });

			expect(response?.status).toBe(400);
		});

		test('returns null for unmatched routes', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.handler(createMockEvent('https://brandtegrity.io/not-a-route'))).resolves.toBeNull();
		});

		test('returns null when the method does not match', async () => {
			const { sdk } = createServerSDK();

			await expect(sdk.handler({ request: new Request('https://brandtegrity.io/auth/login', { method: 'POST' }) })).resolves.toBeNull();
		});
	});
});
