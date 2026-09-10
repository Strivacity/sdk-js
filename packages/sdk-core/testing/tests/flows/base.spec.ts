import { beforeEach, describe, test, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createOptions, getMockStorage } from '@strivacity/testing/mocks/sdk';
import { worker } from '@strivacity/testing/mocks/msw';
import openidConfiguration from '@strivacity/testing/fixtures/openid-configuration.json';
import { createBaseFlow } from '../../../src/flows/base';
import { getDefaultFlowState, ConfigurationError, OidcError, ProtocolError, NetworkError, ServerError } from '../../../src/utils';
import { timestamp } from '../../../src/utils/common';
import type { FlowState } from '../../../src/types/oidc';
import { buildIdToken } from '@strivacity/testing/mocks/oidc';

describe('createBaseFlow', () => {
	let options: ReturnType<typeof createOptions>;
	let flowState: FlowState;
	let base: ReturnType<typeof createBaseFlow>;

	beforeEach(() => {
		globalThis.location.href = 'https://brandtegrity.io';

		options = createOptions({ urlHandler: vi.fn() });
		flowState = getDefaultFlowState();
		base = createBaseFlow(flowState, options);
	});

	describe('events', () => {
		test('should invoke subscribers with the dispatched arguments', () => {
			const callback = vi.fn();
			base.subscribeToEvent('sessionCleared', callback);

			base.dispatchEvent('sessionCleared', []);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should stop invoking a subscriber after it is disposed', () => {
			const callback = vi.fn();
			const subscription = base.subscribeToEvent('sessionCleared', callback);

			subscription.dispose();
			base.dispatchEvent('sessionCleared', []);

			expect(callback).not.toHaveBeenCalled();
		});

		test('should invoke a subscribeToAllEvents callback for any event', () => {
			const callback = vi.fn();
			base.subscribeToAllEvents(callback);

			base.dispatchEvent('sessionCleared', []);
			base.dispatchEvent('logoutInitiated', [{ idToken: 'id-token' }]);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenCalledWith({ idToken: 'id-token' });
		});

		test('should stop invoking a subscribeToAllEvents callback after it is disposed', () => {
			const callback = vi.fn();
			const subscription = base.subscribeToAllEvents(callback);

			subscription.dispose();
			base.dispatchEvent('sessionCleared', []);

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('init', () => {
		test('should initialize once and dispatch the init event', async () => {
			const callback = vi.fn();
			base.subscribeToEvent('init', callback);

			await base.init();

			expect(flowState.initialized).toBe(true);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should be a no-op once already initialized', async () => {
			await base.init();
			vi.mocked(options.storage.get).mockClear();

			await base.init();

			expect(options.storage.get).not.toHaveBeenCalled();
		});

		test('should dedupe concurrent init calls', async () => {
			await Promise.all([base.init(), base.init()]);

			expect(options.storage.get).toHaveBeenCalledTimes(1);
		});

		test.each([
			['issuer', { issuer: '' }, 'Missing option: issuer'],
			['clientId', { clientId: '' }, 'Missing option: clientId'],
			['redirectUri', { redirectUri: '' }, 'Missing option: redirectUri'],
		])('should reject with a ConfigurationError when %s is missing', async (_name, overrides, message) => {
			options = createOptions(overrides);
			flowState = getDefaultFlowState();
			base = createBaseFlow(flowState, options);

			await expect(base.init()).rejects.toThrow(new ConfigurationError(message));
			expect(options.logging?.error).toHaveBeenCalledWith('Required option missing', expect.any(ConfigurationError));
		});

		test('should reject with a ConfigurationError when scopes is not an array', async () => {
			options = createOptions({ scopes: 'openid' as unknown as Array<string> });
			flowState = getDefaultFlowState();
			base = createBaseFlow(flowState, options);

			await expect(base.init()).rejects.toThrow(new ConfigurationError('Invalid option: scopes'));
			expect(options.logging?.error).toHaveBeenCalledWith('Invalid option provided', expect.any(ConfigurationError));
		});

		test('should load a persisted session from storage and dispatch sessionLoaded', async () => {
			const session = getMockStorage(options.storage).generateSession();
			const callback = vi.fn();
			base.subscribeToEvent('sessionLoaded', callback);

			await base.init();

			expect(flowState.session).toEqual(session);
			expect(callback).toHaveBeenCalledWith({
				idToken: session.id_token,
				accessToken: session.access_token,
				refreshToken: session.refresh_token,
				claims: session.claims,
			});
		});

		test('should dispatch accessTokenExpired when the loaded session has already expired', async () => {
			const session = getMockStorage(options.storage).generateSession({ expires_at: 0 });
			const callback = vi.fn();
			base.subscribeToEvent('accessTokenExpired', callback);

			await base.init();

			expect(callback).toHaveBeenCalledWith({ accessToken: session.access_token, refreshToken: session.refresh_token });
		});

		test('should skip storage access when serverSessionUri is set', async () => {
			options = createOptions({ serverSessionUri: 'https://app.example.com/login' });
			flowState = getDefaultFlowState();
			base = createBaseFlow(flowState, options);

			await base.init();

			expect(options.storage.get).not.toHaveBeenCalled();
			expect(flowState.session).toBeNull();
		});
	});

	describe('getSession', () => {
		test('should initialize the flow and return the loaded session', async () => {
			const session = getMockStorage(options.storage).generateSession();

			await expect(base.getSession()).resolves.toEqual(session);
		});

		test('should return null when there is no active session', async () => {
			await expect(base.getSession()).resolves.toBeNull();
		});
	});

	describe('updateSession', () => {
		test('should persist the session to storage and dispatch sessionUpdated', async () => {
			const session = getMockStorage(options.storage).generateSession(undefined, null);
			const callback = vi.fn();
			base.subscribeToEvent('sessionUpdated', callback);

			await base.updateSession(session);

			expect(flowState.session).toBe(session);
			expect(getMockStorage(options.storage).getSession()).toEqual(session);
			expect(callback).toHaveBeenCalledWith({
				idToken: session.id_token,
				accessToken: session.access_token,
				refreshToken: session.refresh_token,
				claims: session.claims,
			});
		});

		test('should skip persisting to storage when serverSessionUri is set', async () => {
			options = createOptions({ serverSessionUri: 'https://app.example.com/login' });
			flowState = getDefaultFlowState();
			base = createBaseFlow(flowState, options);
			const session = getMockStorage(options.storage).generateSession(undefined, null);

			await base.updateSession(session);

			expect(options.storage.set).not.toHaveBeenCalled();
			expect(flowState.session).toBe(session);
		});
	});

	describe('cleanupSession', () => {
		test('should remove the session from storage and dispatch sessionCleared', async () => {
			getMockStorage(options.storage).generateSession();
			await base.init();
			const callback = vi.fn();
			base.subscribeToEvent('sessionCleared', callback);

			await base.cleanupSession();

			expect(flowState.session).toBeNull();
			expect(getMockStorage(options.storage).getSession()).toBeUndefined();
			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should skip storage access when serverSessionUri is set', async () => {
			options = createOptions({ serverSessionUri: 'https://app.example.com/login' });
			flowState = getDefaultFlowState();
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			base = createBaseFlow(flowState, options);

			await base.cleanupSession();

			expect(options.storage.delete).not.toHaveBeenCalled();
			expect(flowState.session).toBeNull();
		});
	});

	describe('checkAuthentication', () => {
		test('should return true for a valid, non-expired session', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);

			await expect(base.checkAuthentication()).resolves.toBe(true);
		});

		test('should return false when there is no session', async () => {
			flowState.initialized = true;

			await expect(base.checkAuthentication()).resolves.toBe(false);
		});

		test('should attempt a refresh when the access token expired and autoRefresh is enabled', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ expires_at: 0 }, null);

			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			await expect(base.checkAuthentication()).resolves.toBe(true);
			expect(flowState.session?.access_token).toBe('new-access-token');
		});

		test('should return false when the refresh fails', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ expires_at: 0 }, null);

			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => new HttpResponse(null, { status: 400 })));

			await expect(base.checkAuthentication()).resolves.toBe(false);
		});

		test('should not attempt a refresh when autoRefresh is disabled', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ expires_at: 0 }, null);

			await expect(base.checkAuthentication({ autoRefresh: false })).resolves.toBe(false);
		});
	});

	describe('tokenExchange', () => {
		test('should exchange the code for tokens and dispatch loggedIn', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);
			const callback = vi.fn();
			base.subscribeToEvent('loggedIn', callback);

			await base.tokenExchange({ code: 'abc123', state: stateData.id });

			expect(flowState.session?.access_token).toBe('access-token');
			expect(callback).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token' }));
		});

		test('should reject when the response is missing an access_token', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ token_type: 'Bearer', expires_in: 3600 })));

			await expect(base.tokenExchange({ code: 'abc123', state: stateData.id })).rejects.toThrow(new ProtocolError('Missing access_token'));
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(ProtocolError));
		});

		test('should dedupe concurrent calls sharing the same state', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			let requestCount = 0;
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => {
					requestCount += 1;
					return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
				}),
			);

			await Promise.all([base.tokenExchange({ code: 'abc123', state: stateData.id }), base.tokenExchange({ code: 'abc123', state: stateData.id })]);

			expect(requestCount).toBe(1);
		});

		test('should throw an OidcError when the callback params contain an OIDC error', async () => {
			await expect(base.tokenExchange({ error: 'access_denied', error_description: 'User denied access' })).rejects.toThrow(
				new OidcError('access_denied', 'User denied access'),
			);
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(OidcError));
		});

		test('should throw a ProtocolError when the authorization code is missing', async () => {
			await expect(base.tokenExchange({ state: 'whatever' })).rejects.toThrow(new ProtocolError('Invalid or missing authorization code'));
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(ProtocolError));
		});

		test('should throw a ProtocolError when the stored state cannot be parsed', async () => {
			await options.stateStorage.set('sty.corrupted-state', 'not-json');

			await expect(base.tokenExchange({ code: 'abc123', state: 'corrupted-state' })).rejects.toThrow(new ProtocolError('Invalid or missing state'));
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(ProtocolError));
		});

		test('should throw an OidcError when the token endpoint responds with an OAuth error', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ error: 'invalid_grant', error_description: 'Code expired' }, { status: 400 }),
				),
			);

			await expect(base.tokenExchange({ code: 'abc123', state: stateData.id })).rejects.toThrow(new OidcError('invalid_grant', 'Code expired'));
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(OidcError));
		});

		test('should throw an OidcError when the token endpoint response body contains an error despite a 200 status', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ error: 'invalid_grant', error_description: 'Code already used' })),
			);

			await expect(base.tokenExchange({ code: 'abc123', state: stateData.id })).rejects.toThrow(new OidcError('invalid_grant', 'Code already used'));
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(OidcError));
		});

		test('should verify the ID token and populate claims when the response includes an id_token', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			const idToken = buildIdToken({
				iss: 'https://brandtegrity.io/',
				sub: 'user-1',
				aud: 'client-id',
				exp: timestamp() + 3600,
				iat: timestamp(),
				nonce: stateData.nonce,
			});
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'access-token', id_token: idToken, token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			await base.tokenExchange({ code: 'abc123', state: stateData.id });

			expect(flowState.session?.claims).toMatchObject({ sub: 'user-1' });
		});

		test('should expose a lower acr than requested via claims, letting the caller decide whether it was satisfied', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState({
				metadata: { acrValues: ['urn:mace:incommon:iap:silver'] },
			});
			const idToken = buildIdToken({
				iss: 'https://brandtegrity.io/',
				sub: 'user-1',
				aud: 'client-id',
				exp: timestamp() + 3600,
				iat: timestamp(),
				nonce: stateData.nonce,
				acr: 'urn:mace:incommon:iap:bronze',
			});
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'access-token', id_token: idToken, token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			await base.tokenExchange({ code: 'abc123', state: stateData.id });

			expect(flowState.session?.claims?.acr).toBe('urn:mace:incommon:iap:bronze');
		});

		test('should throw a ProtocolError when response body is not valid JSON', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.text('<html>not json</html>')));

			await expect(base.tokenExchange({ code: 'abc123', state: stateData.id })).rejects.toThrow(new ProtocolError('Non-JSON response from token endpoint'));
			expect(options.logging?.error).toHaveBeenCalledWith('Token exchange failed', expect.any(ProtocolError));
		});

		describe('hostile authorization response battery', () => {
			test('should reject an unknown state without ever calling the token endpoint', async () => {
				const sendTokenRequestSpy = vi.spyOn(options.httpClient, 'sendTokenRequest');

				await expect(base.tokenExchange({ code: 'abc123', state: 'never-issued' })).rejects.toThrow(new ProtocolError('Invalid or missing state'));

				expect(sendTokenRequestSpy).not.toHaveBeenCalled();
			});

			test('should reject when state is absent though code is present', async () => {
				await expect(base.tokenExchange({ code: 'abc123' })).rejects.toThrow(new ProtocolError('Invalid or missing state'));
			});

			test("should use only the code_verifier belonging to the given state, never a different journey's", async () => {
				const stateA = await getMockStorage(options.stateStorage).generateState();
				const stateB = await getMockStorage(options.stateStorage).generateState();
				let capturedVerifier: string | null = null;
				worker.use(
					http.post('https://brandtegrity.io/oauth2/token', async ({ request }) => {
						capturedVerifier = new URLSearchParams(await request.text()).get('code_verifier');
						return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
					}),
				);

				await base.tokenExchange({ code: 'code-for-a', state: stateA.id });

				expect(capturedVerifier).toBe(stateA.codeVerifier);
				expect(capturedVerifier).not.toBe(stateB.codeVerifier);
			});

			test('should not re-exchange a replayed redirect using the same state twice', async () => {
				const stateData = await getMockStorage(options.stateStorage).generateState();
				let requestCount = 0;
				worker.use(
					http.post('https://brandtegrity.io/oauth2/token', () => {
						requestCount += 1;
						return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
					}),
				);

				await base.tokenExchange({ code: 'abc123', state: stateData.id });

				await expect(base.tokenExchange({ code: 'abc123', state: stateData.id })).rejects.toThrow(new ProtocolError('Invalid or missing state'));
				expect(requestCount).toBe(1);
			});

			test('should fail closed on the error when both code and error are present, regardless of state', async () => {
				const sendTokenRequestSpy = vi.spyOn(options.httpClient, 'sendTokenRequest');

				await expect(base.tokenExchange({ code: 'abc123', error: 'access_denied', state: 'whatever' })).rejects.toThrow(new OidcError('access_denied', null));

				expect(sendTokenRequestSpy).not.toHaveBeenCalled();
			});

			test.each([
				'invalid_request',
				'unauthorized_client',
				'access_denied',
				'unsupported_response_type',
				'invalid_scope',
				'server_error',
				'temporarily_unavailable',
				'login_required',
				'consent_required',
				'interaction_required',
			])('should surface the "%s" authorization error verbatim', async (code) => {
				await expect(base.tokenExchange({ error: code, error_description: 'a description', state: 'whatever' })).rejects.toThrow(
					new OidcError(code, 'a description'),
				);
			});

			test('should send the authorization code verbatim, without re-encoding, even 2KB long with reserved characters', async () => {
				const stateData = await getMockStorage(options.stateStorage).generateState();
				const hostileCode = `${'a'.repeat(2000)}+/=`;
				let capturedCode: string | null = null;
				worker.use(
					http.post('https://brandtegrity.io/oauth2/token', async ({ request }) => {
						capturedCode = new URLSearchParams(await request.text()).get('code');
						return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
					}),
				);

				await base.tokenExchange({ code: hostileCode, state: stateData.id });

				expect(capturedCode).toBe(hostileCode);
			});

			test('should accept a matching iss when the authorization server advertises RFC 9207', async () => {
				vi.resetModules();

				const { createBaseFlow: freshCreateBaseFlow } = await import('../../../src/flows/base');
				const { getDefaultFlowState: freshGetDefaultFlowState } = await import('../../../src/utils/oidc');

				worker.use(
					http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
						HttpResponse.json({ ...openidConfiguration, authorization_response_iss_parameter_supported: true }),
					),
					http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
				);

				const freshOptions = createOptions({ urlHandler: vi.fn() });
				const freshFlowState = freshGetDefaultFlowState();
				const freshBase = freshCreateBaseFlow(freshFlowState, freshOptions);
				const stateData = await getMockStorage(freshOptions.stateStorage).generateState();

				await freshBase.tokenExchange({ code: 'abc123', state: stateData.id, iss: 'https://brandtegrity.io/' });

				expect(freshFlowState.session?.access_token).toBe('access-token');
			});
		});
	});

	describe('handleCallback', () => {
		test('should parse the callback url and exchange the code for tokens', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			await base.handleCallback(`https://brandtegrity.io/callback?code=abc123&state=${stateData.id}`);

			expect(flowState.session?.access_token).toBe('access-token');
		});
	});

	describe('refresh', () => {
		test('should refresh the session and dispatch tokenRefreshed', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'Bearer', expires_in: 3600 }),
				),
			);
			const callback = vi.fn();
			base.subscribeToEvent('tokenRefreshed', callback);

			await base.refresh();

			expect(flowState.session?.access_token).toBe('new-access-token');
			expect(callback).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access-token' }));
		});

		test('should be a no-op when there is no refresh token', async () => {
			flowState.initialized = true;

			await expect(base.refresh()).resolves.toBeUndefined();
		});

		test('should clean up the session and dispatch tokenRefreshFailed on failure', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => new HttpResponse(null, { status: 400 })));
			const callback = vi.fn();
			base.subscribeToEvent('tokenRefreshFailed', callback);

			await expect(base.refresh()).rejects.toThrow();

			expect(flowState.session).toBeNull();
			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should preserve the session and not clean it up when the refresh fails with a recoverable ServerError', async () => {
			flowState.initialized = true;
			const session = getMockStorage(options.storage).generateSession(undefined, null);
			flowState.session = session;
			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => new HttpResponse(null, { status: 500 })));
			const callback = vi.fn();
			base.subscribeToEvent('tokenRefreshFailed', callback);

			await expect(base.refresh()).rejects.toThrow(ServerError);

			expect(flowState.session).toBe(session);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should preserve the session and not clean it up when the refresh fails with a recoverable NetworkError', async () => {
			flowState.initialized = true;
			const session = getMockStorage(options.storage).generateSession(undefined, null);
			flowState.session = session;
			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.error()));

			await expect(base.refresh()).rejects.toThrow(NetworkError);

			expect(flowState.session).toBe(session);
		});

		test('should dedupe concurrent refresh calls', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			let requestCount = 0;
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => {
					requestCount += 1;
					return HttpResponse.json({ access_token: 'new-access-token', token_type: 'Bearer', expires_in: 3600 });
				}),
			);

			await Promise.all([base.refresh(), base.refresh()]);

			expect(requestCount).toBe(1);
		});

		test('should clean up the session and throw an OidcError when the refresh response body contains an error', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ error: 'invalid_grant', error_description: 'Refresh token revoked' })),
			);

			await expect(base.refresh()).rejects.toThrow(new OidcError('invalid_grant', 'Refresh token revoked'));

			expect(flowState.session).toBeNull();
		});

		test('should throw a ProtocolError when response body is not valid JSON', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.text('<html>not json</html>')));

			await expect(base.refresh()).rejects.toThrow(new ProtocolError('Non-JSON response from token endpoint'));
		});

		test('should verify the ID token and populate claims when the refreshed session includes an id_token', async () => {
			flowState.initialized = true;
			const session = getMockStorage(options.storage).generateSession(undefined, null);
			flowState.session = session;
			const idToken = buildIdToken({
				iss: 'https://brandtegrity.io/',
				sub: session.claims!.sub,
				aud: 'client-id',
				exp: timestamp() + 3600,
				iat: timestamp(),
			});
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', id_token: idToken, token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			await base.refresh();

			expect(flowState.session?.claims).toMatchObject({ sub: session.claims!.sub });
		});

		test("rejects (and ends the session, per the SDK's fail-closed refresh policy) when the refreshed id_token has a different sub", async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			const idToken = buildIdToken({
				iss: 'https://brandtegrity.io/',
				sub: 'a-completely-different-user',
				aud: 'client-id',
				exp: timestamp() + 3600,
				iat: timestamp(),
			});
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', id_token: idToken, token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			await expect(base.refresh()).rejects.toThrow(new ProtocolError('Invalid sub'));

			expect(flowState.session).toBeNull();
		});

		test('the old refresh token is gone from raw storage once rotation completes, never reusable', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ refresh_token: 'old-refresh-token' }, null);
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', () =>
					HttpResponse.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'Bearer', expires_in: 3600 }),
				),
			);

			await base.refresh();

			expect(flowState.session?.refresh_token).toBe('new-refresh-token');
			expect(getMockStorage(options.storage).values().join('\n')).not.toContain('old-refresh-token');
		});

		test('never requests a scope beyond the original grant', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ scope: 'openid profile' }, null);
			let capturedBody: URLSearchParams | undefined;
			worker.use(
				http.post('https://brandtegrity.io/oauth2/token', async ({ request }) => {
					capturedBody = new URLSearchParams(await request.text());

					return HttpResponse.json({ access_token: 'new-access-token', token_type: 'Bearer', expires_in: 3600 });
				}),
			);

			await base.refresh();

			expect(capturedBody?.has('scope')).toBe(false);
		});

		test('an already-expired loaded session is not deleted merely for being expired — only a failed refresh deletes it', async () => {
			getMockStorage(options.storage).generateSession({ expires_at: 0 });

			await base.init();

			expect(flowState.session).not.toBeNull();
			expect(getMockStorage(options.storage).getSession()).not.toBeUndefined();
		});
	});

	describe('revoke', () => {
		test('should clean up the session before revoking and dispatch tokenRevoked', async () => {
			flowState.initialized = true;
			const session = getMockStorage(options.storage).generateSession(undefined, null);
			flowState.session = session;
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));
			const revokedCallback = vi.fn();
			const clearedCallback = vi.fn();
			base.subscribeToEvent('tokenRevoked', revokedCallback);
			base.subscribeToEvent('sessionCleared', clearedCallback);

			await base.revoke();

			expect(flowState.session).toBeNull();
			expect(revokedCallback).toHaveBeenCalledWith({ token: session.refresh_token, tokenTypeHint: 'refresh_token' });
			expect(clearedCallback).toHaveBeenCalledTimes(1);
		});

		test('should revoke the access token when there is no refresh token', async () => {
			flowState.initialized = true;
			const session = getMockStorage(options.storage).generateSession({ refresh_token: null }, null);
			flowState.session = session;
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));
			const revokedCallback = vi.fn();
			base.subscribeToEvent('tokenRevoked', revokedCallback);

			await base.revoke();

			expect(flowState.session).toBeNull();
			expect(revokedCallback).toHaveBeenCalledWith({ token: session.access_token, tokenTypeHint: 'access_token' });
		});

		test('should be a no-op when there is no session', async () => {
			flowState.initialized = true;

			await expect(base.revoke()).resolves.toBeUndefined();
		});

		test('should dispatch tokenRevokeFailed and rethrow on failure', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => new HttpResponse(null, { status: 400 })));
			const callback = vi.fn();
			base.subscribeToEvent('tokenRevokeFailed', callback);

			await expect(base.revoke()).rejects.toThrow();

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should treat a 200 response as success even for an already-invalid token', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));
			const revokedCallback = vi.fn();
			const failedCallback = vi.fn();
			base.subscribeToEvent('tokenRevoked', revokedCallback);
			base.subscribeToEvent('tokenRevokeFailed', failedCallback);

			await expect(base.revoke()).resolves.toBeUndefined();

			expect(revokedCallback).toHaveBeenCalledTimes(1);
			expect(failedCallback).not.toHaveBeenCalled();
		});

		test('should reject with a recoverable ServerError on a 503, but the local session is already torn down', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => new HttpResponse(null, { status: 503 })));

			await expect(base.revoke()).rejects.toThrow(ServerError);

			expect(flowState.session).toBeNull();
			expect(getMockStorage(options.storage).getSession()).toBeUndefined();
		});

		test('should dispatch tokenRevokeFailed with the access token when there is no refresh token', async () => {
			flowState.initialized = true;
			const session = getMockStorage(options.storage).generateSession({ refresh_token: null }, null);
			flowState.session = session;
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => new HttpResponse(null, { status: 400 })));
			const callback = vi.fn();
			base.subscribeToEvent('tokenRevokeFailed', callback);

			await expect(base.revoke()).rejects.toThrow();

			expect(callback).toHaveBeenCalledWith({ token: session.access_token, tokenTypeHint: 'access_token' });
		});

		test('should dedupe concurrent revoke calls', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			let requestCount = 0;
			worker.use(
				http.post('https://brandtegrity.io/oauth2/revoke', () => {
					requestCount += 1;
					return HttpResponse.json({});
				}),
			);

			await Promise.all([base.revoke(), base.revoke()]);

			expect(requestCount).toBe(1);
		});

		test('should skip the revocation request and still dispatch tokenRevoked when there is no revocation_endpoint', async () => {
			vi.resetModules();

			const { createBaseFlow: freshCreateBaseFlow } = await import('../../../src/flows/base');
			const { getDefaultFlowState: freshGetDefaultFlowState } = await import('../../../src/utils/oidc');

			worker.use(
				http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
					HttpResponse.json({ ...openidConfiguration, revocation_endpoint: undefined }),
				),
			);

			const freshOptions = createOptions({ urlHandler: vi.fn() });
			const freshFlowState = freshGetDefaultFlowState();
			const freshBase = freshCreateBaseFlow(freshFlowState, freshOptions);
			freshFlowState.initialized = true;
			const session = getMockStorage(freshOptions.storage).generateSession(undefined, null);
			freshFlowState.session = session;
			const callback = vi.fn();
			freshBase.subscribeToEvent('tokenRevoked', callback);

			await freshBase.revoke();

			expect(freshFlowState.session).toBeNull();
			expect(callback).toHaveBeenCalledWith({ token: session.refresh_token, tokenTypeHint: 'refresh_token' });
			expect(freshOptions.logging?.debug).toHaveBeenCalledWith('Revocation skipped: no revocation_endpoint available');
		});
	});

	describe('logout', () => {
		test('should clean up the session and redirect to the end-session endpoint', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ id_token: 'id-token' }, null);
			const callback = vi.fn();
			base.subscribeToEvent('logoutInitiated', callback);

			await base.logout({ postLogoutRedirectUri: 'https://brandtegrity.io/bye' });

			expect(flowState.session).toBeNull();
			expect(callback).toHaveBeenCalledWith(expect.objectContaining({ idToken: 'id-token' }));

			const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];
			expect(`${url.origin}${url.pathname}`).toBe('https://brandtegrity.io/oauth2/sessions/logout');
			expect(url.searchParams.get('id_token_hint')).toBe('id-token');
			expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://brandtegrity.io/bye');
			expect(params).toEqual({ postLogoutRedirectUri: 'https://brandtegrity.io/bye' });
		});

		test('should be a no-op redirect when there is no id token', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);

			await base.logout();

			expect(flowState.session).toBeNull();
			expect(options.urlHandler).not.toHaveBeenCalled();
		});

		test('should log and swallow errors when redirecting to the end-session endpoint fails', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ id_token: 'id-token' }, null);
			const error = new Error('redirect failed');
			vi.mocked(options.urlHandler).mockRejectedValueOnce(error);

			await expect(base.logout()).resolves.toBeUndefined();

			expect(flowState.session).toBeNull();
			expect(options.logging?.error).toHaveBeenCalledWith('Unable to redirect to the end-session endpoint', error);
		});

		test('should dedupe concurrent logout calls', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ id_token: 'id-token' }, null);

			await Promise.all([base.logout(), base.logout()]);

			expect(options.urlHandler).toHaveBeenCalledTimes(1);
		});

		test('should be a clean no-op when there was never a session at all', async () => {
			flowState.initialized = true;

			await expect(base.logout()).resolves.toBeUndefined();

			expect(flowState.session).toBeNull();
			expect(options.urlHandler).not.toHaveBeenCalled();
		});

		test('should complete local teardown and report the failure when end_session_endpoint is absent', async () => {
			vi.resetModules();

			const { createBaseFlow: freshCreateBaseFlow } = await import('../../../src/flows/base');
			const { getDefaultFlowState: freshGetDefaultFlowState } = await import('../../../src/utils/oidc');

			worker.use(
				http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
					HttpResponse.json({ ...openidConfiguration, end_session_endpoint: undefined }),
				),
			);

			const freshOptions = createOptions({ urlHandler: vi.fn() });
			const freshFlowState = freshGetDefaultFlowState();
			const freshBase = freshCreateBaseFlow(freshFlowState, freshOptions);
			freshFlowState.initialized = true;
			freshFlowState.session = getMockStorage(freshOptions.storage).generateSession({ id_token: 'id-token' }, null);

			await expect(freshBase.logout()).resolves.toBeUndefined();

			expect(freshFlowState.session).toBeNull();
			expect(freshOptions.urlHandler).not.toHaveBeenCalled();
			expect(freshOptions.logging?.error).toHaveBeenCalledWith('Unable to redirect to the end-session endpoint', expect.any(Error));
		});

		test('should leave no tokens or session data in raw storage after logout', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ id_token: 'id-token' }, null);

			await base.logout();

			expect(getMockStorage(options.storage).getSession()).toBeUndefined();
			expect(getMockStorage(options.storage).values()).not.toEqual(expect.arrayContaining([expect.stringContaining('id-token')]));
		});
	});

	describe('mutual exclusion between refresh and revoke/logout', () => {
		test('refresh should wait for an in-flight revoke and become a no-op once the session is cleared', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession(undefined, null);
			worker.use(http.post('https://brandtegrity.io/oauth2/revoke', () => HttpResponse.json({})));

			const revokePromise = base.revoke();
			const refreshPromise = base.refresh();

			await revokePromise;
			await expect(refreshPromise).resolves.toBeUndefined();

			expect(flowState.session).toBeNull();
		});

		test('refresh should wait for an in-flight logout and become a no-op once the session is cleared', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ id_token: 'id-token' }, null);

			const logoutPromise = base.logout();
			const refreshPromise = base.refresh();

			await logoutPromise;
			await expect(refreshPromise).resolves.toBeUndefined();

			expect(flowState.session).toBeNull();
		});

		test('revoke should wait for an in-flight refresh and revoke the freshly refreshed token instead of the stale one', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ refresh_token: 'old-refresh-token' }, null);

			let resolveTokenRequest: ((response: Response) => void) | undefined;
			worker.use(
				http.post(
					'https://brandtegrity.io/oauth2/token',
					() =>
						new Promise<Response>((resolve) => {
							resolveTokenRequest = resolve;
						}),
				),
			);

			let revokedToken: string | null = null;
			worker.use(
				http.post('https://brandtegrity.io/oauth2/revoke', async ({ request }) => {
					revokedToken = new URLSearchParams(await request.text()).get('token');
					return HttpResponse.json({});
				}),
			);

			const refreshPromise = base.refresh();
			const revokePromise = base.revoke();

			await vi.waitFor(() => expect(resolveTokenRequest).toBeDefined());
			resolveTokenRequest!(HttpResponse.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'Bearer', expires_in: 3600 }));

			await refreshPromise;
			await revokePromise;

			expect(flowState.session).toBeNull();
			expect(revokedToken).toBe('new-refresh-token');
		});

		test('logout should wait for an in-flight refresh and reflect the post-refresh session state', async () => {
			flowState.initialized = true;
			flowState.session = getMockStorage(options.storage).generateSession({ id_token: 'old-id-token' }, null);

			let resolveTokenRequest: ((response: Response) => void) | undefined;
			worker.use(
				http.post(
					'https://brandtegrity.io/oauth2/token',
					() =>
						new Promise<Response>((resolve) => {
							resolveTokenRequest = resolve;
						}),
				),
			);

			const refreshPromise = base.refresh();
			const logoutPromise = base.logout();

			await vi.waitFor(() => expect(resolveTokenRequest).toBeDefined());
			resolveTokenRequest!(HttpResponse.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'Bearer', expires_in: 3600 }));

			await refreshPromise;
			await logoutPromise;

			expect(flowState.session).toBeNull();
			expect(options.urlHandler).not.toHaveBeenCalled();
		});
	});
});
