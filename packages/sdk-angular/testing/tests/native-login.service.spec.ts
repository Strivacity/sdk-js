import type { NativeFlow, NativeFlowState, SessionData } from '../../src/types';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { StrivacityAuthService } from '../../src/lib/services/auth.service';
import { StrivacityNativeLoginService } from '../../src/lib/services/native-login.service';
import { STRIVACITY_SDK } from '../../src/lib/utils';
import { createMockFlow, createOptions } from '@strivacity/testing/mocks/sdk';
import { mountWithProviders } from '../utils/testbed';

vi.mock('@strivacity/sdk-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core')>()),
	initFlow: vi.fn(),
}));

function configure(flow: NativeFlow): StrivacityNativeLoginService {
	vi.mocked(initFlow).mockReturnValue(flow);

	TestBed.configureTestingModule({
		providers: [{ provide: STRIVACITY_SDK, useValue: createOptions({ mode: 'native' }) }, StrivacityAuthService, StrivacityNativeLoginService],
	});

	return TestBed.inject(StrivacityNativeLoginService);
}

beforeEach(() => {
	vi.mocked(initFlow).mockReset();
});

describe('StrivacityNativeLoginService', () => {
	describe('start', () => {
		test('initializes the sdk and starts a session, defaulting params to an empty object', async () => {
			const flow = createMockFlow<NativeFlow>();
			const login = configure(flow);

			await login.start();

			expect(flow.init).toHaveBeenCalledTimes(1);
			expect(flow.startSession).toHaveBeenCalledWith({});
		});

		test('forwards the given login params to sdk.startSession', async () => {
			const flow = createMockFlow<NativeFlow>();
			const login = configure(flow);

			await login.start({ params: { sessionId: 'session-1', language: 'hu-HU' } });

			expect(flow.startSession).toHaveBeenCalledWith({ sessionId: 'session-1', language: 'hu-HU' });
		});

		test('is loading until sdk.startSession resolves with a state that has no pending finalizeUrl', async () => {
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.startSession).mockResolvedValue({ screen: 'identifier' });
			const login = configure(flow);

			const pending = login.start();

			expect(login.loading()).toBe(true);

			await pending;

			expect(login.loading()).toBe(false);
		});

		test('stays loading forever if sdk.startSession resolves with no state at all', async () => {
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.startSession).mockResolvedValue(undefined);
			const login = configure(flow);

			await login.start();

			expect(login.loading()).toBe(true);
		});

		test('applies the returned flow state: resets per-form data, routes the global message, and keeps per-widget messages', async () => {
			const state: NativeFlowState = {
				hostedUrl: 'https://brandtegrity.io/hosted',
				screen: 'identifier',
				forms: [{ id: 'form1', type: 'form', widgets: [] }],
				messages: {
					global: { type: 'info', text: 'Welcome' },
					form1: { field1: { type: 'error', text: 'Required' } },
				},
			};
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.startSession).mockResolvedValue(state);
			const onGlobalMessage = vi.fn();
			const login = configure(flow);

			await login.start({ onGlobalMessage });

			expect(onGlobalMessage).toHaveBeenCalledWith({ type: 'info', text: 'Welcome' });
			expect(login.forms()).toEqual({ form1: {} });
			expect(login.messages()).toEqual({ form1: { field1: { type: 'error', text: 'Required' } } });
			expect(login.state()).toEqual(state);
		});

		test('keeps loading while a finalizeUrl is still pending', async () => {
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.startSession).mockResolvedValue({ finalizeUrl: 'https://brandtegrity.io/finalize' });
			const login = configure(flow);

			await login.start();

			expect(login.loading()).toBe(true);
		});

		test('calls onLogin and leaves the tracked state untouched when the sdk already has a session', async () => {
			const session = { access_token: 'access-token' } as unknown as SessionData;
			const flow = createMockFlow<NativeFlow>({ session });
			vi.mocked(flow.startSession).mockResolvedValue({ screen: 'identifier' });
			const onLogin = vi.fn();
			const login = configure(flow);

			await login.start({ onLogin });

			expect(onLogin).toHaveBeenCalledWith(session);
			expect(login.state()).toEqual({});
		});

		test('routes a FallbackError from sdk.startSession to onFallback and logs it', async () => {
			const flow = createMockFlow<NativeFlow>();
			const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
			vi.mocked(flow.startSession).mockRejectedValue(fallbackError);
			const onFallback = vi.fn();
			const login = configure(flow);

			await login.start({ onFallback });

			expect(onFallback).toHaveBeenCalledWith(fallbackError);
			expect(flow.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
			expect(login.loading()).toBe(true);
		});

		test('routes a non-fallback error from sdk.startSession to onError and logs it', async () => {
			const flow = createMockFlow<NativeFlow>();
			const error = new Error('network down');
			vi.mocked(flow.startSession).mockRejectedValue(error);
			const onError = vi.fn();
			const login = configure(flow);

			await login.start({ onError });

			expect(onError).toHaveBeenCalledWith(error);
			expect(flow.logging!.error).toHaveBeenCalledWith('Error starting session', error);
			// startSession() has its own catch-all and never rethrows, so start()'s "set loading false on error" branch never runs for this path
			expect(login.loading()).toBe(true);
		});

		test('propagates a rejection from sdk.init() as-is, since only the startSession() call is guarded by the try/catch', async () => {
			// the AbortError short-circuit in start()'s own catch guards `this.startSession(...)`, not `await this.sdk.init()`
			// above it - startSession() also swallows every error itself (including AbortError) and reports it through onError,
			// so that branch is unreachable via a mocked flow; a rejecting init() is the one thing genuinely uncaught here.
			const flow = createMockFlow<NativeFlow>();
			const abortError = new DOMException('The operation was aborted', 'AbortError');
			vi.mocked(flow.init).mockRejectedValue(abortError);
			const onError = vi.fn();
			const login = configure(flow);

			await expect(login.start({ onError })).rejects.toBe(abortError);

			expect(onError).not.toHaveBeenCalled();
			expect(flow.startSession).not.toHaveBeenCalled();
		});
	});

	describe('submitForm', () => {
		test('unflattens the tracked form values and calls through to sdk.submitForm', async () => {
			const flow = createMockFlow<NativeFlow>();
			const initialForms = [{ id: 'form1', type: 'form' as const, widgets: [] }];
			vi.mocked(flow.startSession).mockResolvedValue({ screen: 'identifier', forms: initialForms });
			vi.mocked(flow.submitForm).mockResolvedValue({ screen: 'done' });
			const login = configure(flow);

			await login.start();

			login.setFormValue('form1', 'address.city', 'Budapest');
			login.setFormValue('form1', 'address.zip', '');

			await login.submitForm('form1');

			expect(flow.submitForm).toHaveBeenCalledWith('form1', { address: { city: 'Budapest', zip: null } });
			// unspecified fields on the new state fall back to what was already tracked (except messages, which always resets)
			expect(login.state()).toEqual({
				hostedUrl: undefined,
				finalizeUrl: undefined,
				screen: 'done',
				forms: initialForms,
				layout: undefined,
				messages: {},
				branding: undefined,
			});
		});

		test('uses a given custom body instead of the tracked form values', async () => {
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.submitForm).mockResolvedValue({ screen: 'done' });
			const login = configure(flow);
			await login.start();

			await login.submitForm('form1', { raw: true });

			expect(flow.submitForm).toHaveBeenCalledWith('form1', { raw: true });
		});

		test('routes a FallbackError to onFallback', async () => {
			const flow = createMockFlow<NativeFlow>();
			const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
			vi.mocked(flow.submitForm).mockRejectedValue(fallbackError);
			const onFallback = vi.fn();
			const login = configure(flow);
			await login.start({ onFallback });

			await login.submitForm('form1');

			expect(onFallback).toHaveBeenCalledWith(fallbackError);
			expect(flow.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
		});

		test('routes a non-fallback error to onError', async () => {
			const flow = createMockFlow<NativeFlow>();
			const error = new Error('submit failed');
			vi.mocked(flow.submitForm).mockRejectedValue(error);
			const onError = vi.fn();
			const login = configure(flow);
			await login.start({ onError });

			await login.submitForm('form1');

			expect(onError).toHaveBeenCalledWith(error);
			expect(flow.logging!.error).toHaveBeenCalledWith('Error submitting form', error);
		});
	});

	test('setFormValue coerces empty strings to null and lazily creates the form bucket', async () => {
		const flow = createMockFlow<NativeFlow>();
		const login = configure(flow);
		await login.start();

		login.setFormValue('newForm', 'field', 'value');
		login.setFormValue('newForm', 'other', '');

		expect(login.forms().newForm).toEqual({ field: 'value', other: null });
	});

	test('setMessage lazily creates the message bucket for a form', async () => {
		const flow = createMockFlow<NativeFlow>();
		const login = configure(flow);
		await login.start();

		login.setMessage('newForm', 'field', { type: 'error', text: 'Required' });

		expect(login.messages().newForm).toEqual({ field: { type: 'error', text: 'Required' } });
	});

	describe('triggerFallback', () => {
		test('throws when no hosted URL is known yet', async () => {
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.startSession).mockResolvedValue({ screen: 'identifier' });
			const login = configure(flow);
			await login.start();

			expect(() => login.triggerFallback()).toThrow('No hosted URL provided');
			expect(flow.logging!.error).toHaveBeenCalledWith('Fallback error', expect.any(Error));
		});

		test('calls onFallback with a FallbackError built from the known hosted URL', async () => {
			const flow = createMockFlow<NativeFlow>();
			vi.mocked(flow.startSession).mockResolvedValue({ hostedUrl: 'https://brandtegrity.io/hosted', screen: 'identifier' });
			const onFallback = vi.fn();
			const login = configure(flow);
			await login.start({ onFallback });

			login.triggerFallback('manual trigger');

			expect(flow.logging!.warn).toHaveBeenCalledWith('Triggering fallback due to: manual trigger');
			expect(onFallback).toHaveBeenCalledWith(expect.any(FallbackError));
			expect((onFallback.mock.calls[0][0] as FallbackError).url.toString()).toBe('https://brandtegrity.io/hosted');
		});
	});

	test('triggerClose calls onClose and logs', async () => {
		const flow = createMockFlow<NativeFlow>();
		const onClose = vi.fn();
		const login = configure(flow);
		await login.start({ onClose });

		login.triggerClose();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(flow.logging!.debug).toHaveBeenCalledWith('Triggering close');
	});

	test('aborts the in-flight abort controller when the owning injector is destroyed', () => {
		const flow = createMockFlow<NativeFlow>();
		vi.mocked(initFlow).mockReturnValue(flow);
		TestBed.configureTestingModule({ providers: [{ provide: STRIVACITY_SDK, useValue: createOptions({ mode: 'native' }) }, StrivacityAuthService] });

		const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

		// both services must live on the component's own injector for fixture.destroy() to fire their DestroyRef callbacks
		const { destroy } = mountWithProviders([StrivacityAuthService, StrivacityNativeLoginService], () => inject(StrivacityNativeLoginService));

		destroy();

		expect(abortSpy).toHaveBeenCalledTimes(1);
		abortSpy.mockRestore();
	});
});
