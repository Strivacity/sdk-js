import { type MockInstance, vi, describe, test, expect, beforeEach } from 'vitest';
import { type SDKOptions, type NativeParams, initFlow } from '../../src';
import { type NativeFlowHandler } from '../../src/utils/NativeFlowHandler';
import { DefaultLogging } from '../../src/utils/Logging';

import { mockLocalStorage } from '@strivacity/testing/mocks/storages';

describe('NativeFlowHandler', () => {
	const options: SDKOptions = {
		mode: 'native',
		issuer: 'https://brandtegrity.io',
		scopes: ['openid', 'profile'],
		clientId: '2202c596c06e4774b42804af00c66df9',
		redirectUri: 'https://brandtegrity.io/app/callback/',
		responseType: 'code',
		responseMode: 'query',
		logging: DefaultLogging,
	};
	const spyInitFlow = (options: SDKOptions, params: NativeParams = {}) => {
		const flow = initFlow(options);
		const spies: Record<string, MockInstance> = {
			httpClient: vi.spyOn(flow.httpClient, 'request'),
			tokenExchange: vi.spyOn(flow, 'tokenExchange'),
			fetchMetadata: vi.spyOn(flow.metadata, 'fetchMetadata'),
			// @ts-expect-error: Protected function
			dispatchEvent: vi.spyOn(flow, 'dispatchEvent'),
			// @ts-expect-error: Protected function
			waitToInitialize: vi.spyOn(flow, 'waitToInitialize'),
			// @ts-expect-error: Protected function
			sendTokenRequest: vi.spyOn<unknown>(flow, 'sendTokenRequest'),
		};
		const loggingSpy = {
			debug: vi.spyOn(flow.logging!, 'debug'),
			info: vi.spyOn(flow.logging!, 'info'),
			warn: vi.spyOn(flow.logging!, 'warn'),
			error: vi.spyOn(flow.logging!, 'error'),
			get xEventId() {
				return flow.logging!.xEventId;
			},
		};
		const handler = flow.login(params) as NativeFlowHandler;

		return { handler, flow, spies, loggingSpy };
	};
	let storage = mockLocalStorage();

	beforeEach(() => {
		storage = mockLocalStorage();
	});

	describe('startSession', () => {
		test('should start session w/o sessionId', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?session_id=sessionId`),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ forms: [] }),
			});

			const response = await handler.startSession();

			const state = storage.getLastState();
			const authorizationUrl = new URL(spies.httpClient.mock.calls[1][0]);
			const initUrl = new URL(spies.httpClient.mock.calls[2][0]);

			expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
			expect(spies.waitToInitialize).toHaveBeenCalledTimes(0);
			expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
			expect(loggingSpy.info).toHaveBeenCalledWith('Starting login flow session');
			expect(loggingSpy.xEventId).toBeUndefined();
			expect(authorizationUrl.origin).toEqual(options.issuer);
			expect(authorizationUrl.pathname).toEqual('/oauth2/auth');
			expect(authorizationUrl.searchParams.get('client_id')).toEqual(options.clientId);
			expect(authorizationUrl.searchParams.get('redirect_uri')).toEqual(options.redirectUri);
			expect(authorizationUrl.searchParams.get('response_type')).toEqual(options.responseType);
			expect(authorizationUrl.searchParams.get('response_mode')).toEqual(options.responseMode);
			expect(authorizationUrl.searchParams.get('scope')).toEqual(options.scopes?.join(' '));
			expect(authorizationUrl.searchParams.get('code_challenge_method')).toEqual('S256');
			expect(authorizationUrl.searchParams.get('state')).toEqual(state?.id);
			expect(authorizationUrl.searchParams.get('code_challenge')).toEqual(state?.codeChallenge);
			expect(authorizationUrl.searchParams.get('nonce')).toEqual(state?.nonce);
			expect(authorizationUrl.searchParams.get('sdk')).toEqual('web');

			// @ts-expect-error: sessionId is protected
			expect(handler.sessionId).toEqual('sessionId');

			expect(initUrl.origin).toEqual(options.issuer);
			expect(initUrl.pathname).toEqual('/flow/api/v1/init');

			expect(response).toEqual({ forms: [] });
		});

		test('should continue session w/ sessionId', async () => {
			const { handler, spies } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ forms: [] }),
			});

			const response = await handler.startSession('sessionId');

			const initUrl = new URL(spies.httpClient.mock.calls[0][0]);

			expect(storage.spies.set).not.toHaveBeenCalled();
			expect(spies.waitToInitialize).toHaveBeenCalledTimes(0);
			expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);

			// @ts-expect-error: sessionId is protected
			expect(handler.sessionId).toEqual('sessionId');

			expect(initUrl.origin).toEqual(options.issuer);
			expect(initUrl.pathname).toEqual('/flow/api/v1/init');

			expect(response).toEqual({ forms: [] });
		});

		describe('should call tokenExchange during fast path', () => {
			test('w/ valid url', async () => {
				const { handler, spies, loggingSpy } = spyInitFlow(options);

				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
				});
				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					text: () => Promise.resolve(`${options.redirectUri}?code=1234`),
				});
				spies.tokenExchange.mockResolvedValueOnce(Promise.resolve());

				await handler.startSession();

				expect(loggingSpy.info).toHaveBeenCalledWith('Starting login flow session');
				expect(spies.tokenExchange).toHaveBeenCalledWith({ code: '1234' });
			});

			test('should fallback to response.url when text() fails', async () => {
				const { handler, spies, loggingSpy } = spyInitFlow(options);

				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
				});
				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					url: `${options.redirectUri}?session_id=sessionId`,
					text: () => Promise.reject(new Error('text() failed')),
				});
				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ forms: [] }),
				});

				const response = await handler.startSession();

				expect(loggingSpy.info).toHaveBeenCalledWith('Starting login flow session');
				// @ts-expect-error: sessionId is protected
				expect(handler.sessionId).toEqual('sessionId');
				expect(response).toEqual({ forms: [] });
			});

			test('w/o valid url', async () => {
				const { handler, spies, loggingSpy } = spyInitFlow(options);

				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
				});
				spies.httpClient.mockResolvedValueOnce({
					ok: true,
					text: () => Promise.resolve('https://invalid.url?code=1234'),
				});

				await expect(() => handler.startSession()).rejects.toThrowError('Invalid redirect URI');
				expect(loggingSpy.error).toHaveBeenCalledWith('Invalid redirect URI', expect.any(Error));
			});
		});

		test('should throw error on OIDC error', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?error=invalid_request&error_description=text`),
			});

			await expect(() => handler.startSession()).rejects.toThrowError('invalid_request: text');
			expect(loggingSpy.error).toHaveBeenCalledWith('Authorization error', expect.any(Error));
		});

		test('should throw error on missing session_id', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(options.redirectUri),
			});

			await expect(() => handler.startSession()).rejects.toThrowError('"session_id" is missing from the response');
			expect(loggingSpy.error).toHaveBeenCalledWith('Failed to start a session', expect.any(Error));
		});

		test('should throw error w/o callbackHandler', async () => {
			// @ts-expect-error: Invalid options
			const { handler, spies, loggingSpy } = spyInitFlow({ ...options, callbackHandler: 'invalid' });

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve('https://invalid.url?code=1234'),
			});

			await expect(() => handler.startSession()).rejects.toThrowError('Missing option: callbackHandler');
			expect(loggingSpy.error).toHaveBeenCalledWith('Required option missing', expect.any(Error));
		});
	});

	describe('finalizeSession', () => {
		test('should finalize session', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?code=1234`),
			});
			spies.tokenExchange.mockResolvedValueOnce(Promise.resolve());

			await handler.finalizeSession(`${options.issuer}/oauth2/finalize`);

			expect(loggingSpy.debug).toHaveBeenCalledWith('Finalizing login flow session');
			expect(spies.tokenExchange).toHaveBeenCalledWith({ code: '1234' });
		});

		test('should throw error on invalid redirect URI', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve('https://invalid.url?code=1234'),
			});

			await expect(() => handler.finalizeSession(`${options.issuer}/oauth2/finalize`)).rejects.toThrowError('Invalid redirect URI');
			expect(loggingSpy.error).toHaveBeenCalledWith('Finalize session error', expect.any(Error));
		});

		test('should throw error w/o callbackHandler', async () => {
			// @ts-expect-error: Invalid options
			const { handler, spies, loggingSpy } = spyInitFlow({ ...options, callbackHandler: 'invalid' });

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve('https://invalid.url?code=1234'),
			});

			await expect(() => handler.finalizeSession(`${options.issuer}/oauth2/finalize`)).rejects.toThrowError('Missing option: callbackHandler');
			expect(loggingSpy.error).toHaveBeenCalledWith('Required option missing', expect.any(Error));
		});
	});

	describe('submitForm', () => {
		test('should submit init form correctly', async () => {
			const { handler, spies } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ forms: [] }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';
			const response = await handler.submitForm();

			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/flow/api/v1/init`, {
				method: 'POST',
				headers: { Authorization: 'Bearer sessionId', 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
				credentials: 'include',
			});

			expect(response).toEqual({ forms: [] });
		});

		test('should submit form with formId and data', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ forms: [] }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';
			const response = await handler.submitForm('formId', { key: 'value' });

			expect(loggingSpy.debug).toHaveBeenCalledWith('Submitting form: formId');
			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/flow/api/v1/form/formId`, {
				method: 'POST',
				headers: { Authorization: 'Bearer sessionId', 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: 'value' }),
				credentials: 'include',
			});

			expect(response).toEqual({ forms: [] });
		});

		test('should finalize session after form submission', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ finalizeUrl: `${options.issuer}/oauth2/finalize` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?code=1234`),
			});
			spies.tokenExchange.mockResolvedValueOnce(Promise.resolve());

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';
			await handler.submitForm();

			expect(loggingSpy.debug).toHaveBeenCalledWith('Finalizing login flow session');
			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/oauth2/finalize`, {
				method: 'GET',
				headers: { Authorization: `Bearer sessionId` },
				credentials: 'include',
			});
			expect(spies.tokenExchange).toHaveBeenCalledWith({ code: '1234' });
		});

		test('should throw FallbackError on invalid response', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ hostedUrl: 'https://example.com' }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';

			await expect(() => handler.submitForm()).rejects.toThrowError('Fallback occurred');
			expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback due to: No forms or messages in response');

			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/flow/api/v1/init`, {
				method: 'POST',
				headers: { Authorization: 'Bearer sessionId', 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
				credentials: 'include',
			});
		});

		test('should handle 400 error responses', async () => {
			const { handler, spies } = spyInitFlow(options);
			const errorResponse = { messages: { global: { type: 'error', text: 'Error message' } } };

			spies.httpClient.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				json: () => Promise.resolve(errorResponse),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';

			const response = await handler.submitForm();

			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/flow/api/v1/init`, {
				method: 'POST',
				headers: { Authorization: 'Bearer sessionId', 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
				credentials: 'include',
			});

			expect(response).toEqual(errorResponse);
		});

		test('should handle 401 error responses', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: () => Promise.resolve({ hostedUrl: 'https://example.com' }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';

			await expect(() => handler.submitForm()).rejects.toThrowError('Fallback occurred');
			expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback due to: Received HTTP 401 without messages');

			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/flow/api/v1/init`, {
				method: 'POST',
				headers: { Authorization: 'Bearer sessionId', 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
				credentials: 'include',
			});
		});

		test('should handle 403 error responses', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: false,
				status: 403,
				statusText: 'Forbidden',
				json: () => Promise.resolve({ hostedUrl: 'https://example.com' }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';

			await expect(() => handler.submitForm()).rejects.toThrowError('HTTP 403: Forbidden');
			expect(loggingSpy.error).toHaveBeenCalledWith('Form submission error', expect.any(Error));

			expect(spies.httpClient).toHaveBeenCalledWith(`${options.issuer}/flow/api/v1/init`, {
				method: 'POST',
				headers: { Authorization: 'Bearer sessionId', 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
				credentials: 'include',
			});
		});

		test('should handle 4xx error responses without hostedUrl and messages', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				json: () => Promise.resolve({ hostedUrl: 'https://example.com' }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';

			await expect(() => handler.submitForm()).rejects.toThrowError();

			expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback due to: Received HTTP 404 without messages');
		});

		test('should handle response with screen property', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ screen: 'login-screen', forms: [] }),
			});

			// @ts-expect-error: sessionId is protected
			handler.sessionId = 'sessionId';

			const response = await handler.submitForm();

			expect(loggingSpy.info).toHaveBeenCalledWith('Rendering screen: login-screen');
			expect(response).toEqual({ screen: 'login-screen', forms: [] });
		});
	});
});
