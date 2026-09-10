import { beforeEach, describe, test, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createOptions, getMockStorage } from '@strivacity/testing/mocks/sdk';
import { worker } from '@strivacity/testing/mocks/msw';
import { createNativeFlow } from '../../../src/flows/native';
import { FallbackError, NetworkError, OidcError, ProtocolError, ServerError, SessionExpiredError } from '../../../src/utils';

describe('createNativeFlow', () => {
	let options: ReturnType<typeof createOptions>;
	let flow: ReturnType<typeof createNativeFlow>;

	beforeEach(() => {
		globalThis.location.href = 'https://brandtegrity.io';

		options = createOptions();
		flow = createNativeFlow(options);
	});

	describe('init', () => {
		test('lazyLoad: true', async () => {
			flow = createNativeFlow(createOptions({ lazyLoad: true }));

			// We need to wait for the next tick to ensure that any asynchronous initialization logic has a chance to run before we check the initialized state.
			await Promise.resolve();

			expect(flow.initialized).toBe(false);

			await flow.init();

			expect(flow.initialized).toBe(true);
		});

		test('lazyLoad: false', async () => {
			flow = createNativeFlow(createOptions({ lazyLoad: false }));

			await vi.waitFor(() => expect(flow.initialized).toBe(true));
		});
	});

	describe('startSession', () => {
		test('should submit the init form and collect the session identifiers when the response contains a session_id', async () => {
			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', () =>
					HttpResponse.text('https://brandtegrity.io/login?session_id=abc123&short_app_id=app&language=hu-HU'),
				),
				http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })),
			);

			const data = await flow.startSession();

			expect(flow.sessionId).toBe('abc123');
			expect(flow.shortAppId).toBe('app');
			expect(flow.language).toBe('hu-HU');
			expect(data).toEqual({ screen: 'identification' });
		});

		test('should continue an existing session without contacting the authorization endpoint when a sessionId is provided', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })));

			const data = await flow.startSession({ sessionId: 'existing-session' });

			expect(flow.sessionId).toBe('existing-session');
			expect(data).toEqual({ screen: 'identification' });
		});

		describe('should exchange the code for tokens', () => {
			test('w/o serverSessionUri', async () => {
				worker.use(
					http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
						const state = new URL(request.url).searchParams.get('state');

						return HttpResponse.text(`https://brandtegrity.io/callback?code=abc123&state=${state}`);
					}),
					http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
				);

				await flow.startSession();

				expect(globalThis.location.href).toBe('https://brandtegrity.io/');
				expect(flow.accessToken).toBe('access-token');
			});

			test('w/ serverSessionUri', async () => {
				worker.use(http.get('https://app.example.com/login', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')));

				options = createOptions({ serverSessionUri: 'https://app.example.com/login' });
				flow = createNativeFlow(options);

				await flow.startSession();

				expect(globalThis.location.href).toBe('https://brandtegrity.io/callback?code=abc123');
				expect(flow.accessToken).toBeNull();
			});
		});
	});

	describe('submitForm', () => {
		test('should throw an error when the session ID is missing', async () => {
			await expect(flow.submitForm()).rejects.toThrow('Session ID is missing. Cannot submit form.');
		});

		test('should submit to the init endpoint when no formId is provided', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })));

			flow.sessionId = 'abc123';

			await expect(flow.submitForm()).resolves.toEqual({ screen: 'identification' });
		});

		test('should submit to the form-specific endpoint when a formId is provided', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/form/identifier', () => HttpResponse.json({ screen: 'password' })));

			flow.sessionId = 'abc123';

			await expect(flow.submitForm('identifier', { username: 'user' })).resolves.toEqual({ screen: 'password' });
		});

		test('should finalize the session and exchange the code for tokens when the response contains a finalizeUrl', async () => {
			const stateData = await getMockStorage(options.stateStorage).generateState();

			worker.use(
				http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ finalizeUrl: 'https://brandtegrity.io/finalize' })),
				http.get('https://brandtegrity.io/finalize', () => HttpResponse.text(`https://brandtegrity.io/callback?code=abc123&state=${stateData.id}`)),
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			flow.sessionId = 'abc123';

			await flow.submitForm();

			expect(flow.accessToken).toBe('access-token');
		});

		test('should reject with a SessionExpiredError on HTTP 403', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => new HttpResponse(null, { status: 403 })));

			flow.sessionId = 'abc123';

			await expect(flow.submitForm()).rejects.toThrow(SessionExpiredError);
		});

		test('should reject with a FallbackError when the response only contains a hostedUrl', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ hostedUrl: 'https://brandtegrity.io/hosted' })));

			flow.sessionId = 'abc123';

			await expect(flow.submitForm()).rejects.toThrow(FallbackError);
		});

		test('the SDK never opens a browser/popup itself on a Fallback', async () => {
			const urlHandler = vi.fn();
			options = createOptions({ urlHandler });
			flow = createNativeFlow(options);
			flow.sessionId = 'abc123';
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ hostedUrl: 'https://brandtegrity.io/hosted' })));

			await expect(flow.submitForm()).rejects.toThrow(FallbackError);

			expect(urlHandler).not.toHaveBeenCalled();
		});

		test('a chained journey of rejections returns each screen independently, never bleeding a stale message into a later one', async () => {
			flow.sessionId = 'abc123';

			worker.use(
				http.post('https://brandtegrity.io/flow/api/v1/form/password', () =>
					HttpResponse.json({ screen: 'password', messages: { global: { type: 'error', text: 'Wrong password' } } }),
				),
			);
			const first = await flow.submitForm('password', { password: 'wrong-1' });
			expect(first.messages?.global?.text).toBe('Wrong password');

			worker.use(
				http.post('https://brandtegrity.io/flow/api/v1/form/password', () =>
					HttpResponse.json({ screen: 'password', messages: { global: { type: 'error', text: 'Account locked' } } }),
				),
			);
			const second = await flow.submitForm('password', { password: 'wrong-2' });
			expect(second.messages?.global?.text).toBe('Account locked');
			expect(second.messages?.global?.text).not.toBe(first.messages?.global?.text);

			worker.use(http.post('https://brandtegrity.io/flow/api/v1/form/password', () => HttpResponse.json({ screen: 'passcode' })));
			const third = await flow.submitForm('password', { password: 'correct' });
			expect(third.messages).toBeUndefined();
			expect(third.screen).toBe('passcode');
		});
	});

	describe('finalizeSession', () => {
		test('should throw when the session ID is missing', async () => {
			await expect(flow.finalizeSession('https://brandtegrity.io/finalize')).rejects.toThrow('Session ID is missing. Cannot finalize login session.');
		});

		describe('should exchange the code for tokens', () => {
			test('w/o serverSessionUri', async () => {
				const stateData = await getMockStorage(options.stateStorage).generateState();

				worker.use(
					http.get('https://brandtegrity.io/finalize', () => HttpResponse.text(`https://brandtegrity.io/callback?code=abc123&state=${stateData.id}`)),
					http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
				);

				flow.sessionId = 'abc123';

				await flow.finalizeSession('https://brandtegrity.io/finalize');

				expect(flow.accessToken).toBe('access-token');
			});

			test('w/ serverSessionUri', async () => {
				worker.use(http.get('https://brandtegrity.io/finalize', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')));

				options = createOptions({ serverSessionUri: 'https://app.example.com/login' });
				flow = createNativeFlow(options);

				flow.sessionId = 'abc123';

				await flow.finalizeSession('https://brandtegrity.io/finalize');

				expect(globalThis.location.href).toBe('https://brandtegrity.io/callback?code=abc123');
				expect(flow.accessToken).toBeNull();
			});
		});

		test('should throw a ProtocolError when the redirect URI in the response is invalid', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => HttpResponse.text('not-a-valid-url')));

			flow.sessionId = 'abc123';

			await expect(flow.finalizeSession('https://brandtegrity.io/finalize')).rejects.toThrow(new ProtocolError('Invalid redirect URI'));
			expect(flow.options.logging?.error).toHaveBeenCalledWith('Finalize login session error', expect.any(ProtocolError));
		});
	});

	describe('login', () => {
		test('backward compatibility', async () => {
			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', () =>
					HttpResponse.text('https://brandtegrity.io/login?session_id=xyz789&short_app_id=app2&language=en-US'),
				),
				http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })),
			);

			const loginFlow = flow.login();

			expect(loginFlow.sessionId).toBeNull();
			expect(loginFlow.shortAppId).toBeNull();
			expect(loginFlow.language).toBe('en-US');

			loginFlow.sessionId = 'abc123';
			loginFlow.shortAppId = 'app';
			loginFlow.language = 'hu-HU';

			expect(flow.sessionId).toBe('abc123');
			expect(flow.shortAppId).toBe('app');
			expect(flow.language).toBe('hu-HU');

			await loginFlow.startSession();

			expect(flow.sessionId).toBe('xyz789');
			expect(flow.shortAppId).toBe('app2');
			expect(flow.language).toBe('en-US');

			const stateData = await getMockStorage(options.stateStorage).generateState();

			worker.use(
				http.get('https://brandtegrity.io/finalize', () => HttpResponse.text(`https://brandtegrity.io/callback?code=abc123&state=${stateData.id}`)),
				http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 })),
			);

			await loginFlow.finalizeSession('https://brandtegrity.io/finalize');

			expect(flow.accessToken).toBe('access-token');
		});

		test('should forward login params to startSession', async () => {
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
					capturedUrl = new URL(request.url);

					return HttpResponse.text('https://brandtegrity.io/login?session_id=abc123&short_app_id=app&language=en-US');
				}),
				http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })),
			);

			await flow.login({ prompt: 'login', loginHint: 'test@example.com' }).startSession();

			expect(capturedUrl?.searchParams.get('prompt')).toBe('login');
			expect(capturedUrl?.searchParams.get('login_hint')).toBe('test@example.com');
			expect(flow.sessionId).toBe('abc123');
			expect(flow.shortAppId).toBe('app');
			expect(flow.language).toBe('en-US');
		});

		test('should submit forms through the login flow instance', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/form/identifier', () => HttpResponse.json({ screen: 'password' })));

			const loginFlow = flow.login();
			loginFlow.sessionId = 'abc123';

			await expect(loginFlow.submitForm('identifier', { username: 'user' })).resolves.toEqual({ screen: 'password' });
		});
	});

	describe('register', () => {
		test('should force the "create" prompt', async () => {
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/oauth2/auth', ({ request }) => {
					capturedUrl = new URL(request.url);

					return HttpResponse.text('https://brandtegrity.io/login?session_id=abc123&short_app_id=app&language=en-US');
				}),
				http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })),
			);

			await flow.register().startSession();

			expect(capturedUrl?.searchParams.get('prompt')).toBe('create');
			expect(flow.sessionId).toBe('abc123');
			expect(flow.shortAppId).toBe('app');
			expect(flow.language).toBe('en-US');
		});
	});

	describe('entry', () => {
		test('should fetch the entry data preserving query parameters', async () => {
			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', ({ request }) => {
					capturedUrl = new URL(request.url);

					return HttpResponse.text('https://brandtegrity.io/entry?session_id=abc123&short_app_id=app&language=hu-HU');
				}),
			);

			const data = await flow.entry('https://brandtegrity.io/entry?challenge=abc123&foo=bar');

			expect(capturedUrl?.searchParams.get('challenge')).toBe('abc123');
			expect(capturedUrl?.searchParams.get('foo')).toBe('bar');
			expect(capturedUrl?.searchParams.get('sdk')).toBe('web');
			expect(capturedUrl?.searchParams.get('client_id')).toBe('client-id');
			expect(capturedUrl?.searchParams.get('redirect_uri')).toBe('https://brandtegrity.io/callback');
			expect(data).toEqual({ session_id: 'abc123', short_app_id: 'app', language: 'hu-HU' });
			expect(flow.session).toBeNull();
			await expect(flow.isAuthenticated).resolves.toBe(false);
		});

		test('should default to the current window location when no url is provided', async () => {
			window.location.search = '?challenge=abc123&foo=bar';

			let capturedUrl: URL | undefined;

			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', ({ request }) => {
					capturedUrl = new URL(request.url);

					return HttpResponse.text('https://brandtegrity.io/entry?session_id=abc123&short_app_id=app&language=hu-HU');
				}),
			);

			const data = await flow.entry();

			expect(capturedUrl?.searchParams.get('challenge')).toBe('abc123');
			expect(capturedUrl?.searchParams.get('foo')).toBe('bar');
			expect(data.session_id).toBe('abc123');
		});

		describe('should reject with an error when the HTTP request fails', () => {
			test('HTTP 400', async () => {
				worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => new HttpResponse('{}', { status: 400 })));

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(new ProtocolError('Entry request failed'));
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(ProtocolError));
			});

			test('HTTP 400 with an OIDC error body', async () => {
				worker.use(
					http.get('https://brandtegrity.io/provider/flow/entry', () =>
						HttpResponse.json({ error: 'access_denied', error_description: 'User denied access' }, { status: 400 }),
					),
				);

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(new OidcError('access_denied', 'User denied access'));
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(OidcError));
			});

			test('HTTP 400 with an errorKey body', async () => {
				worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => HttpResponse.json({ errorKey: 'invalid_request' }, { status: 400 })));

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(new ProtocolError('invalid_request'));
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(ProtocolError));
			});

			test('HTTP 429', async () => {
				worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => new HttpResponse(null, { status: 429 })));

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(new ServerError('Entry request failed', 429));
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(ServerError));
			});

			test('HTTP 500', async () => {
				worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => new HttpResponse(null, { status: 500 })));

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(new ServerError('Entry request failed', 500));
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(ServerError));
			});

			test('HTTP 503', async () => {
				worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => HttpResponse.error()));

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(
					new NetworkError('Network request failed: https://brandtegrity.io/provider/flow/entry'),
				);
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(NetworkError));
			});

			test('should throw a ProtocolError when "session_id" is missing from the response', async () => {
				worker.use(http.get('https://brandtegrity.io/provider/flow/entry', () => HttpResponse.text('https://brandtegrity.io/entry?short_app_id=app')));

				await expect(flow.entry('https://brandtegrity.io/entry?challenge=abc123')).rejects.toThrow(
					new ProtocolError('"session_id" is missing from the response'),
				);
				expect(flow.options.logging?.error).toHaveBeenCalledWith('Entry request failed', expect.any(ProtocolError));
			});
		});

		test('should fall back to the response URL when the response body is not a valid URL', async () => {
			worker.use(
				http.get('https://brandtegrity.io/provider/flow/entry', () =>
					HttpResponse.redirect('https://brandtegrity.io/entry-redirected?session_id=abc123&short_app_id=app&language=hu-HU'),
				),
				http.get('https://brandtegrity.io/entry-redirected', () => HttpResponse.text('<html>not a url</html>')),
			);

			const data = await flow.entry('https://brandtegrity.io/entry?challenge=abc123');

			expect(data).toEqual({ session_id: 'abc123', short_app_id: 'app', language: 'hu-HU' });
		});
	});

	test('flow state accessors', async () => {
		options = createOptions({ lazyLoad: true });
		flow = createNativeFlow(options);

		expect(flow.options).toBe(options);
		expect(flow.initialized).toBeFalsy();
		expect(flow.storage).toBe(options.storage);
		expect(flow.httpClient).toBe(options.httpClient);
		expect(flow.logging).toBe(options.logging);
		expect(flow.sessionId).toBeNull();
		expect(flow.shortAppId).toBeNull();
		expect(flow.language).toBe('en-US');
		await expect(flow.isAuthenticated).resolves.toBeFalsy();
		expect(flow.isAuthenticatedSync).toBeFalsy();
		expect(flow.accessToken).toBeNull();
		expect(flow.accessTokenExpired).toBeTruthy();
		expect(flow.accessTokenExpirationDate).toBeNull();
		expect(flow.refreshToken).toBeNull();
		expect(flow.idToken).toBeNull();
		expect(flow.idTokenClaims).toBeNull();

		await flow.init();

		flow.sessionId = 'abc123';
		flow.shortAppId = 'app';
		flow.language = 'hu-HU';
		flow.session = getMockStorage(options.storage).generateSession();

		expect(flow.initialized).toBeTruthy();
		expect(flow.sessionId).toBe('abc123');
		expect(flow.shortAppId).toBe('app');
		expect(flow.language).toBe('hu-HU');
		await expect(flow.isAuthenticated).resolves.toBeTruthy();
		expect(flow.isAuthenticatedSync).toBeTruthy();
		expect(flow.accessToken).toBe(flow.session.access_token);
		expect(flow.accessTokenExpired).toBeFalsy();
		expect(flow.accessTokenExpirationDate).toBe(flow.session.expires_at);
		expect(flow.refreshToken).toBe(flow.session.refresh_token);
		expect(flow.idToken).toBe(flow.session.id_token);
		expect(flow.idTokenClaims).toBe(flow.session?.claims);
	});
});
