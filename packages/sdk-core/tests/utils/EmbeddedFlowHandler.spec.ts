import { type MockInstance, vi, describe, test, expect, beforeEach } from 'vitest';
import { type SDKOptions, type ExtraRequestArgs, initFlow } from '../../src';
import { type EmbeddedFlowHandler } from '../../src/utils/EmbeddedFlowHandler';
import { DefaultLogging } from '../../src/utils/Logging';

import { mockLocalStorage } from '@strivacity/testing/mocks/storages';

describe('EmbeddedFlowHandler', () => {
	const options: SDKOptions = {
		mode: 'embedded',
		issuer: 'https://brandtegrity.io',
		scopes: ['openid', 'profile'],
		clientId: '2202c596c06e4774b42804af00c66df9',
		redirectUri: 'https://brandtegrity.io/app/callback/',
		responseType: 'code',
		responseMode: 'query',
		logging: DefaultLogging,
	};
	const spyInitFlow = (options: SDKOptions, params: ExtraRequestArgs = {}) => {
		const flow = initFlow(options);
		const spies: Record<string, MockInstance> = {
			httpClient: vi.spyOn(flow.httpClient, 'request'),
			tokenExchange: vi.spyOn(flow, 'tokenExchange'),
			fetchMetadata: vi.spyOn(flow.metadata, 'fetchMetadata'),
			// @ts-expect-error: Protected function
			dispatchEvent: vi.spyOn(flow, 'dispatchEvent'),
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
		const handler = flow.login(params) as EmbeddedFlowHandler;

		return { handler, flow, spies, loggingSpy };
	};
	let storage = mockLocalStorage();

	beforeEach(() => {
		storage = mockLocalStorage();
	});

	describe('startSession', () => {
		test('should start session successfully', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?session_id=sessionId&short_app_id=shortAppId`),
			});

			await handler.startSession();

			const state = storage.getLastState();
			const authorizationUrl = new URL(spies.httpClient.mock.calls[1][0]);

			expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
			expect(spies.waitToInitialize).toHaveBeenCalledTimes(1);
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
			expect(authorizationUrl.searchParams.get('sdk')).toEqual('web-embedded');

			expect(handler.sessionId).toEqual('sessionId');
			expect(handler.shortAppId).toEqual('shortAppId');
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
					url: `${options.redirectUri}?code=1234`,
					text: () => Promise.reject(new Error('Failed to read text')),
				});
				spies.tokenExchange.mockResolvedValueOnce(Promise.resolve());

				await handler.startSession();

				expect(loggingSpy.info).toHaveBeenCalledWith('Starting login flow session');
				expect(spies.tokenExchange).toHaveBeenCalledWith({ code: '1234' });
			});

			test('w/ invalid redirect URI', async () => {
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

		test('should throw error on missing short_app_id', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?session_id=sessionId`),
			});

			await expect(() => handler.startSession()).rejects.toThrowError('"short_app_id" is missing from the response');
			expect(loggingSpy.error).toHaveBeenCalledWith('Failed to start a session', expect.any(Error));
		});

		test('should throw error on missing session_id', async () => {
			const { handler, spies, loggingSpy } = spyInitFlow(options);

			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?short_app_id=shortAppId`),
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

			handler.sessionId = 'sessionId';
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

			handler.sessionId = 'sessionId';
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

			handler.sessionId = 'sessionId';
			await expect(() => handler.finalizeSession(`${options.issuer}/oauth2/finalize`)).rejects.toThrowError('Missing option: callbackHandler');
			expect(loggingSpy.error).toHaveBeenCalledWith('Required option missing', expect.any(Error));
		});
	});
});
