import { beforeEach, describe, test, expect } from 'vitest';
import { createOptions, createFakeBaseFlow } from '@strivacity/testing/mocks/sdk';
import { worker, http, HttpResponse } from '@strivacity/testing/mocks/msw';
import { getDefaultFlowState, ProtocolError, OidcError, ServerError, NetworkError, SessionExpiredError, FallbackError } from '../../../src/utils';
import { redirectCallbackHandler } from '../../../src/handlers/redirect';
import { submitFormHandler, startSessionHandler, finalizeSessionHandler } from '../../../src/handlers/native';

describe('startSessionHandler', () => {
	let params: Parameters<typeof startSessionHandler>[0];

	beforeEach(() => {
		globalThis.location.href = 'https://brandtegrity.io';
		params = { base: createFakeBaseFlow(), options: createOptions(), flowState: getDefaultFlowState(), params: {} };
	});

	test('should start session correctly', async () => {
		worker.use(
			http.get('https://brandtegrity.io/oauth2/auth', () =>
				HttpResponse.text('https://brandtegrity.io/login?session_id=abc123&short_app_id=app&language=hu-HU'),
			),
			http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })),
		);

		await expect(startSessionHandler(params)).resolves.toEqual({ screen: 'identification' });

		expect(params.flowState.sessionId).toBe('abc123');
		expect(params.flowState.shortAppId).toBe('app');
		expect(params.flowState.language).toBe('hu-HU');
	});

	test('should continue session correctly', async () => {
		worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })));
		params.params = { sessionId: 'abc123' };

		await expect(startSessionHandler(params)).resolves.toEqual({ screen: 'identification' });

		expect(params.base.dispatchEvent).toHaveBeenCalledWith('flowInitiated', []);
		expect(params.flowState.sessionId).toBe('abc123');
	});

	describe('should exchange the code for tokens correctly', () => {
		test('w/o serverSessionUri', async () => {
			worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')));

			await startSessionHandler(params);

			expect(globalThis.location.href).not.toBe('https://brandtegrity.io/callback?code=abc123');
			expect(params.base.tokenExchange).toHaveBeenCalledWith({ code: 'abc123' });
		});

		test('w/ serverSessionUri', async () => {
			worker.use(http.get('https://brandtegrity.io/login', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')));
			params.options = createOptions({ serverSessionUri: 'https://brandtegrity.io/login' });

			await startSessionHandler(params);

			expect(globalThis.location.href).toBe('https://brandtegrity.io/callback?code=abc123');
			expect(params.base.tokenExchange).not.toHaveBeenCalled();
		});
	});

	test('should reject with a ProtocolError when neither code nor session_id are present', async () => {
		worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => HttpResponse.text('https://brandtegrity.io/login?something=else')));

		await expect(startSessionHandler(params)).rejects.toThrow(new ProtocolError('Neither "code" nor "session_id" is present in the response'));
		expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(ProtocolError));
	});

	test('should reject with an OidcError when the response contains an error', async () => {
		worker.use(
			http.get('https://brandtegrity.io/oauth2/auth', () =>
				HttpResponse.text('https://brandtegrity.io/login?error=access_denied&error_description=nope&error_uri=https://example.com/error'),
			),
		);

		await expect(startSessionHandler(params)).rejects.toThrow(new OidcError('access_denied', 'nope', 'https://example.com/error'));
		expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(OidcError));
	});

	test('should reject with a ProtocolError when the redirect URI does not match the configured redirectUri', async () => {
		worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => HttpResponse.text('https://invalid.domain/callback?code=abc123')));

		await expect(startSessionHandler(params)).rejects.toThrow(new ProtocolError('Invalid redirect URI'));
		expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(ProtocolError));
	});

	describe('should reject with an error when the HTTP request fails', () => {
		test('HTTP 400', async () => {
			worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => new HttpResponse(null, { status: 400 })));

			await expect(startSessionHandler(params)).rejects.toThrow(new ProtocolError('Failed to start login session'));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(ProtocolError));
		});

		test('HTTP 429', async () => {
			worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => new HttpResponse(null, { status: 429 })));

			await expect(startSessionHandler(params)).rejects.toThrow(new ServerError('Failed to start login session', 429));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(ServerError));
		});

		test('HTTP 500', async () => {
			worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => new HttpResponse(null, { status: 500 })));

			await expect(startSessionHandler(params)).rejects.toThrow(new ServerError('Failed to start login session', 500));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(ServerError));
		});

		test('HTTP 503', async () => {
			worker.use(http.get('https://brandtegrity.io/oauth2/auth', () => HttpResponse.error()));

			await expect(startSessionHandler(params)).rejects.toThrow(new NetworkError('Network request failed: https://brandtegrity.io/oauth2/auth'));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Start login session error', expect.any(NetworkError));
		});
	});
});

describe('submitFormHandler', () => {
	let params: Parameters<typeof submitFormHandler>[0];

	beforeEach(() => {
		globalThis.location.href = 'https://brandtegrity.io';
		params = { base: createFakeBaseFlow(), options: createOptions(), flowState: { ...getDefaultFlowState(), sessionId: 'abc123' } };
	});

	test('should submit the login form and return the resulting flow state', async () => {
		worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ screen: 'identification' })));

		await expect(submitFormHandler(params)).resolves.toEqual({ screen: 'identification' });
	});

	test('should submit to the form-specific endpoint when a formId is provided', async () => {
		worker.use(http.post('https://brandtegrity.io/flow/api/v1/form/identifier', () => HttpResponse.json({ screen: 'password' })));
		params.formId = 'identifier';

		await expect(submitFormHandler(params)).resolves.toEqual({ screen: 'password' });
	});

	test('should finalize the session when a finalizeUrl is present in the response', async () => {
		worker.use(
			http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ finalizeUrl: 'https://brandtegrity.io/finalize' })),
			http.get('https://brandtegrity.io/finalize', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')),
		);
		params.options = createOptions({ serverSessionUri: 'https://brandtegrity.io/login' });

		await submitFormHandler(params);

		expect(globalThis.location.href).toBe('https://brandtegrity.io/callback?code=abc123');
	});

	test('should throw when the session ID is missing', async () => {
		params.flowState = getDefaultFlowState();

		await expect(submitFormHandler(params)).rejects.toThrow(new Error('Session ID is missing. Cannot submit form.'));
		expect(params.options.logging?.error).toHaveBeenCalledWith('Failed to submit form', expect.any(Error));
	});

	describe('should reject with an error when the HTTP request fails', () => {
		test('HTTP 403 rejects with a SessionExpiredError', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => new HttpResponse(null, { status: 403 })));

			await expect(submitFormHandler(params)).rejects.toThrow(SessionExpiredError);
			expect(params.options.logging?.error).toHaveBeenCalledWith('Form submission failed', expect.any(SessionExpiredError));
		});

		test('HTTP 400 with a hostedUrl falls back to the hosted UI', async () => {
			worker.use(
				http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.json({ hostedUrl: 'https://brandtegrity.io/hosted' }, { status: 400 })),
			);

			await expect(submitFormHandler(params)).rejects.toThrow(FallbackError);
			expect(params.options.logging?.error).toHaveBeenCalledWith('Form submission failed', expect.any(FallbackError));
		});

		test('HTTP 400 without a hostedUrl', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => new HttpResponse(null, { status: 400 })));

			await expect(submitFormHandler(params)).rejects.toThrow(new ProtocolError('Failed to submit login form'));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Form submission failed', expect.any(ProtocolError));
		});

		test('HTTP 429', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => new HttpResponse(null, { status: 429 })));

			await expect(submitFormHandler(params)).rejects.toThrow(new ServerError('Failed to submit login form', 429));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Form submission failed', expect.any(ServerError));
		});

		test('HTTP 500', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => new HttpResponse(null, { status: 500 })));

			await expect(submitFormHandler(params)).rejects.toThrow(new ServerError('Failed to submit login form', 500));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Form submission failed', expect.any(ServerError));
		});

		test('HTTP 503', async () => {
			worker.use(http.post('https://brandtegrity.io/flow/api/v1/init', () => HttpResponse.error()));

			await expect(submitFormHandler(params)).rejects.toThrow(new NetworkError('Network request failed: https://brandtegrity.io/flow/api/v1/init'));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Form submission failed', expect.any(NetworkError));
		});
	});
});

describe('finalizeSessionHandler', () => {
	let params: Parameters<typeof finalizeSessionHandler>[0];

	beforeEach(() => {
		globalThis.location.href = 'https://brandtegrity.io';
		params = {
			base: createFakeBaseFlow(),
			options: createOptions(),
			flowState: { ...getDefaultFlowState(), sessionId: 'abc123' },
			url: 'https://brandtegrity.io/finalize',
		};
	});

	describe('should finalize session correctly', () => {
		test('w/o serverSessionUri', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')));
			params.options.callbackHandler = redirectCallbackHandler;

			await finalizeSessionHandler(params);

			expect(globalThis.location.href).not.toBe('https://brandtegrity.io/callback?code=abc123');
			expect(params.base.tokenExchange).toHaveBeenCalledWith({ code: 'abc123' });
		});

		test('w/ serverSessionUri', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => HttpResponse.text('https://brandtegrity.io/callback?code=abc123')));
			params.options = createOptions({ serverSessionUri: 'https://brandtegrity.io/login' });

			await finalizeSessionHandler(params);

			expect(globalThis.location.href).toBe('https://brandtegrity.io/callback?code=abc123');
			expect(params.base.tokenExchange).not.toHaveBeenCalled();
		});
	});

	test('should throw when the session ID is missing', async () => {
		params.flowState = getDefaultFlowState();

		await expect(finalizeSessionHandler(params)).rejects.toThrow(new Error('Session ID is missing. Cannot finalize login session.'));
		expect(params.options.logging?.error).toHaveBeenCalledWith('Failed to finalize login session', expect.any(Error));
	});

	test('should reject with a ProtocolError when the redirect URI does not match the configured redirectUri', async () => {
		worker.use(http.get('https://brandtegrity.io/finalize', () => HttpResponse.text('https://invalid.domain/callback?code=abc123')));

		await expect(finalizeSessionHandler(params)).rejects.toThrow(new ProtocolError('Invalid redirect URI'));
		expect(params.options.logging?.error).toHaveBeenCalledWith('Finalize login session error', expect.any(ProtocolError));
	});

	describe('should reject with an error when the HTTP request fails', () => {
		test('HTTP 400', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => new HttpResponse(null, { status: 400 })));

			await expect(finalizeSessionHandler(params)).rejects.toThrow(new ProtocolError('Failed to finalize login session'));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Finalize login session error', expect.any(ProtocolError));
		});

		test('HTTP 429', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => new HttpResponse(null, { status: 429 })));

			await expect(finalizeSessionHandler(params)).rejects.toThrow(new ServerError('Failed to finalize login session', 429));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Finalize login session error', expect.any(ServerError));
		});

		test('HTTP 500', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => new HttpResponse(null, { status: 500 })));

			await expect(finalizeSessionHandler(params)).rejects.toThrow(new ServerError('Failed to finalize login session', 500));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Finalize login session error', expect.any(ServerError));
		});

		test('HTTP 503', async () => {
			worker.use(http.get('https://brandtegrity.io/finalize', () => HttpResponse.error()));

			await expect(finalizeSessionHandler(params)).rejects.toThrow(new NetworkError('Network request failed: https://brandtegrity.io/finalize'));
			expect(params.options.logging?.error).toHaveBeenCalledWith('Finalize login session error', expect.any(NetworkError));
		});
	});
});
