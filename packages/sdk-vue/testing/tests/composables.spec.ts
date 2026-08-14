import type { SDKContext, LoginContext, NativeFlow, NativeFlowState, SessionData } from '../../src/types';
import { describe, test, expect, vi } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { STRIVACITY_SDK, useStrivacity, useNativeLoginContext, useNativeLogin } from '../../src/composables';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { mount, mountWithNativeLogin } from '../utils/common';

describe('useStrivacity', () => {
	test('throws when used outside of a Strivacity SDK provider', () => {
		expect(() => {
			const app = createApp({
				setup() {
					useStrivacity();

					return () => null;
				},
			});
			app.mount(document.createElement('div'));
		}).toThrow('Missing SDK context');
	});

	test('returns the context provided by createStrivacitySDK', () => {
		const sdk = {} as NativeFlow;
		let ctx: SDKContext<NativeFlow> | undefined;

		mount(sdk, () => {
			ctx = useStrivacity<NativeFlow>();
		});

		expect(ctx?.sdk).toBe(sdk);
	});
});

describe('useNativeLoginContext', () => {
	test('throws when used outside of a native login session', () => {
		expect(() => {
			const app = createApp({
				setup() {
					useNativeLoginContext();

					return () => null;
				},
			});
			app.mount(document.createElement('div'));
		}).toThrow('Missing SDK native login context');
	});

	test('resolves to the context provided by an ancestor useNativeLogin call', async () => {
		const sdk = createMockFlow<NativeFlow>();
		let injected: LoginContext | undefined;
		let login!: LoginContext;

		const Child = defineComponent({
			setup() {
				injected = useNativeLoginContext();

				return () => null;
			},
		});
		const Parent = defineComponent({
			setup() {
				login = useNativeLogin();

				return () => h(Child);
			},
		});

		const app = createApp(Parent);
		app.provide(STRIVACITY_SDK, { sdk });
		app.mount(document.createElement('div'));
		await flushPromises();

		expect(injected?.state).toBe(login.state);
		expect(injected?.loading).toBe(login.loading);
		expect(injected?.forms).toBe(login.forms);
		expect(injected?.messages).toBe(login.messages);
		expect(injected?.submitForm).toBe(login.submitForm);
	});
});

describe('useNativeLogin', () => {
	test('initializes the sdk and starts a session on mount, defaulting params to an empty object', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountWithNativeLogin(sdk);

		await flushPromises();

		expect(sdk.init).toHaveBeenCalledTimes(1);
		expect(sdk.startSession).toHaveBeenCalledWith({});
	});

	test('forwards the given login params to sdk.startSession', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountWithNativeLogin(sdk, { params: { sessionId: 'session-1', language: 'hu-HU' } });

		await flushPromises();

		expect(sdk.startSession).toHaveBeenCalledWith({ sessionId: 'session-1', language: 'hu-HU' });
	});

	test('is loading until sdk.startSession resolves with a state that has no pending finalizeUrl', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const { login } = mountWithNativeLogin(sdk);

		expect(login.loading.value).toBe(true);

		await flushPromises();

		expect(login.loading.value).toBe(false);
	});

	test('stays loading forever if sdk.startSession resolves with no state at all', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue(undefined);
		const { login } = mountWithNativeLogin(sdk);

		await flushPromises();

		expect(login.loading.value).toBe(true);
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
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue(state);
		const onGlobalMessage = vi.fn();

		const { login } = mountWithNativeLogin(sdk, { onGlobalMessage });
		await flushPromises();

		expect(onGlobalMessage).toHaveBeenCalledWith({ type: 'info', text: 'Welcome' });
		expect(login.forms.value).toEqual({ form1: {} });
		expect(login.messages.value).toEqual({ form1: { field1: { type: 'error', text: 'Required' } } });
		expect(login.state.value).toEqual(state);
	});

	test('keeps loading while a finalizeUrl is still pending', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ finalizeUrl: 'https://brandtegrity.io/finalize' });

		const { login } = mountWithNativeLogin(sdk);
		await flushPromises();

		expect(login.loading.value).toBe(true);
	});

	test('calls onLogin and leaves the tracked state untouched when the sdk already has a session', async () => {
		const session = { access_token: 'access-token' } as unknown as SessionData;
		const sdk = createMockFlow<NativeFlow>({ session });
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const onLogin = vi.fn();

		const { login } = mountWithNativeLogin(sdk, { onLogin });
		await flushPromises();

		expect(onLogin).toHaveBeenCalledWith(session);
		expect(login.state.value).toEqual({});
	});

	test('routes a FallbackError from sdk.startSession to onFallback and logs it', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
		vi.mocked(sdk.startSession).mockRejectedValue(fallbackError);
		const onFallback = vi.fn();

		const { login } = mountWithNativeLogin(sdk, { onFallback });
		await flushPromises();

		expect(onFallback).toHaveBeenCalledWith(fallbackError);
		expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
		expect(login.loading.value).toBe(true);
	});

	test('routes a non-fallback error from sdk.startSession to onError and logs it', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const error = new Error('network down');
		vi.mocked(sdk.startSession).mockRejectedValue(error);
		const onError = vi.fn();

		mountWithNativeLogin(sdk, { onError });
		await flushPromises();

		expect(onError).toHaveBeenCalledWith(error);
		expect(sdk.logging!.error).toHaveBeenCalledWith('Error starting session', error);
	});

	describe('submitForm', () => {
		test('unflattens the tracked form values and calls through to sdk.submitForm', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const initialForms = [{ id: 'form1', type: 'form' as const, widgets: [] }];
			vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier', forms: initialForms });
			vi.mocked(sdk.submitForm).mockResolvedValue({ screen: 'done' });

			const { login } = mountWithNativeLogin(sdk);
			await flushPromises();

			login.setFormValue('form1', 'address.city', 'Budapest');
			login.setFormValue('form1', 'address.zip', '');

			await login.submitForm('form1');

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { address: { city: 'Budapest', zip: null } });
			// unspecified fields on the new state fall back to what was already tracked (except messages, which always resets)
			expect(login.state.value).toEqual({
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
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.submitForm).mockResolvedValue({ screen: 'done' });

			const { login } = mountWithNativeLogin(sdk);
			await flushPromises();

			await login.submitForm('form1', { raw: true });

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { raw: true });
		});

		test('routes a FallbackError to onFallback', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
			vi.mocked(sdk.submitForm).mockRejectedValue(fallbackError);
			const onFallback = vi.fn();

			const { login } = mountWithNativeLogin(sdk, { onFallback });
			await flushPromises();

			await login.submitForm('form1');

			expect(onFallback).toHaveBeenCalledWith(fallbackError);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
		});

		test('routes a non-fallback error to onError', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const error = new Error('submit failed');
			vi.mocked(sdk.submitForm).mockRejectedValue(error);
			const onError = vi.fn();

			const { login } = mountWithNativeLogin(sdk, { onError });
			await flushPromises();

			await login.submitForm('form1');

			expect(onError).toHaveBeenCalledWith(error);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Error submitting form', error);
		});
	});

	test('setFormValue coerces empty strings to null and lazily creates the form bucket', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { login } = mountWithNativeLogin(sdk);
		await flushPromises();

		login.setFormValue('newForm', 'field', 'value');
		login.setFormValue('newForm', 'other', '');

		expect(login.forms.value.newForm).toEqual({ field: 'value', other: null });
	});

	test('setMessage lazily creates the message bucket for a form', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { login } = mountWithNativeLogin(sdk);
		await flushPromises();

		login.setMessage('newForm', 'field', { type: 'error', text: 'Required' });

		expect(login.messages.value.newForm).toEqual({ field: { type: 'error', text: 'Required' } });
	});

	describe('triggerFallback', () => {
		test('throws when no hosted URL is known yet', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
			const { login } = mountWithNativeLogin(sdk);
			await flushPromises();

			expect(() => login.triggerFallback()).toThrow('No hosted URL provided');
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error', expect.any(Error));
		});

		test('calls onFallback with a FallbackError built from the known hosted URL', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ hostedUrl: 'https://brandtegrity.io/hosted', screen: 'identifier' });
			const onFallback = vi.fn();

			const { login } = mountWithNativeLogin(sdk, { onFallback });
			await flushPromises();

			login.triggerFallback('manual trigger');

			expect(sdk.logging!.warn).toHaveBeenCalledWith('Triggering fallback due to: manual trigger');
			expect(onFallback).toHaveBeenCalledWith(expect.any(FallbackError));
			expect((onFallback.mock.calls[0][0] as FallbackError).url.toString()).toBe('https://brandtegrity.io/hosted');
		});
	});

	test('triggerClose calls onClose and logs', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const onClose = vi.fn();
		const { login } = mountWithNativeLogin(sdk, { onClose });
		await flushPromises();

		login.triggerClose();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(sdk.logging!.debug).toHaveBeenCalledWith('Triggering close');
	});
});
