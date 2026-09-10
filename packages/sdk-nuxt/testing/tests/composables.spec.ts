import type { RedirectFlow, NativeFlow, SessionData, NativeFlowState } from '@strivacity/sdk-core/types';
import type { FallbackError as FallbackErrorType } from '@strivacity/sdk-core/utils/errors';
import type { LoginContext } from '../../src/runtime/types';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { mockInitFlow, mountWithNativeLogin } from '../utils/common';

vi.mock('@strivacity/sdk-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core')>()),
	initFlow: vi.fn(),
}));

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	// vi.doMock() registrations survive vi.resetModules() (only the module cache is cleared), so
	// tests that override the default stubs must revert them here to avoid leaking into the next test.
	vi.doUnmock('#app');
	vi.doUnmock('#strivacity-options-logging');
	vi.doUnmock('#strivacity-options-httpClient');
	vi.doUnmock('../../src/runtime/composables/use-session');
});

describe('useStrivacity', () => {
	test('initializes the underlying flow through core sdk initFlow with the runtime config merged with the logging/httpClient factories', async () => {
		const flow = createMockFlow<RedirectFlow>();
		await mockInitFlow(flow);

		const publicOptions = { mode: 'redirect', issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback' };
		const logging = { debug: vi.fn() };
		const httpClient = { request: vi.fn() };
		vi.doMock('#app', () => ({ useRuntimeConfig: () => ({ public: { strivacity: publicOptions } }) }));
		vi.doMock('#strivacity-options-logging', () => ({ default: () => logging }));
		vi.doMock('#strivacity-options-httpClient', () => ({ default: () => httpClient }));

		const core = await import('@strivacity/sdk-core');
		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		useStrivacity();

		expect(core.initFlow).toHaveBeenCalledWith({ ...publicOptions, logging, httpClient });
	});

	test('passes undefined logging/httpClient through to initFlow when the factory modules resolve to a falsy default', async () => {
		const flow = createMockFlow<RedirectFlow>();
		await mockInitFlow(flow);

		const core = await import('@strivacity/sdk-core');
		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		useStrivacity();

		expect(core.initFlow).toHaveBeenCalledWith(expect.objectContaining({ logging: undefined, httpClient: undefined }));
	});

	test('seeds sdk.session from the initial value returned by useSession', async () => {
		const flow = createMockFlow<RedirectFlow>();
		await mockInitFlow(flow);

		const session = { access_token: 'access-token' } as unknown as SessionData;
		vi.doMock('../../src/runtime/composables/use-session', () => ({ useSession: () => ({ value: session }) }));

		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		const ctx = useStrivacity<RedirectFlow>();

		expect(ctx.sdk.session).toBe(session);
	});

	test('only initializes the flow once: a second call within the same module instance reuses the same sdk instance', async () => {
		const flow = createMockFlow<RedirectFlow>();
		await mockInitFlow(flow);

		const core = await import('@strivacity/sdk-core');
		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		const first = useStrivacity<RedirectFlow>();
		const second = useStrivacity<RedirectFlow>();

		expect(core.initFlow).toHaveBeenCalledTimes(1);
		expect(first.sdk).toBe(second.sdk);
	});

	test('subscribes to all sdk events once during initialization', async () => {
		const flow = createMockFlow<RedirectFlow>();
		await mockInitFlow(flow);

		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		useStrivacity();

		expect(flow.subscribeToAllEvents).toHaveBeenCalledTimes(1);
		expect(flow.subscribeToAllEvents).toHaveBeenCalledWith(expect.any(Function));
	});

	test('mirrors loading/language/isAuthenticated/idTokenClaims/accessToken/refreshToken/accessTokenExpired/accessTokenExpirationDate from the flow instance once the initial session update settles', async () => {
		const flow = createMockFlow<RedirectFlow>({
			isAuthenticated: Promise.resolve(true),
			language: 'hu-HU',
			idTokenClaims: { sub: 'user-1' },
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			accessTokenExpired: false,
			accessTokenExpirationDate: 1234,
		});
		await mockInitFlow(flow);

		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		const ctx = useStrivacity<RedirectFlow>();

		expect(ctx.loading.value).toBe(true);

		await flushPromises();

		expect(ctx.loading.value).toBe(false);
		expect(ctx.isAuthenticated.value).toBe(true);
		expect(ctx.language.value).toBe('hu-HU');
		expect(ctx.idTokenClaims.value).toEqual({ sub: 'user-1' });
		expect(ctx.accessToken.value).toBe('access-token');
		expect(ctx.refreshToken.value).toBe('refresh-token');
		expect(ctx.accessTokenExpired.value).toBe(false);
		expect(ctx.accessTokenExpirationDate.value).toBe(1234);
	});

	test('updates the reactive state again whenever the flow emits an event via subscribeToAllEvents', async () => {
		const subscribeToAllEvents = vi.fn().mockReturnValue({ dispose: vi.fn() });
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents });
		await mockInitFlow(flow);

		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		const ctx = useStrivacity<RedirectFlow>();
		await flushPromises();

		const onEvent = subscribeToAllEvents.mock.calls[0][0] as () => Promise<void>;
		const mutableFlow = flow as unknown as { language: string; accessToken: string | null; isAuthenticated: Promise<boolean> };
		mutableFlow.language = 'de-DE';
		mutableFlow.accessToken = 'new-token';
		mutableFlow.isAuthenticated = Promise.resolve(true);

		await onEvent();
		await flushPromises();

		expect(ctx.language.value).toBe('de-DE');
		expect(ctx.accessToken.value).toBe('new-token');
		expect(ctx.isAuthenticated.value).toBe(true);
	});

	test('subscribeToAllEvents on the returned context calls through to the flow instance', async () => {
		const callback = vi.fn();
		const disposeResult = { dispose: vi.fn() };
		const flow = createMockFlow<RedirectFlow>();
		vi.mocked(flow.subscribeToAllEvents).mockReturnValue(disposeResult);
		await mockInitFlow(flow);

		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		const ctx = useStrivacity<RedirectFlow>();

		// the init-time subscription happens first; this is the caller-facing pass-through
		const result = ctx.subscribeToAllEvents(callback);

		expect(flow.subscribeToAllEvents).toHaveBeenLastCalledWith(callback);
		expect(result).toBe(disposeResult);
	});

	test.each([
		['init', [], undefined],
		['subscribeToEvent', ['loggedIn', vi.fn()], { dispose: vi.fn() }],
		['checkAuthentication', [{ autoRefresh: false }], true],
		['tokenExchange', [{ code: 'abc' }], undefined],
		['handleCallback', ['https://brandtegrity.io/callback?code=abc'], undefined],
		['refresh', [], undefined],
		['revoke', [], undefined],
		['logout', [{ postLogoutRedirectUri: 'https://brandtegrity.io' }], undefined],
		['login', [{ scopes: ['openid'] }], undefined],
		['register', [{ scopes: ['openid'] }], undefined],
		['entry', ['https://brandtegrity.io/entry'], undefined],
	] as const)('%s on the returned context calls through to the flow instance returned by core sdk', async (method, args, resolvedValue) => {
		const flow = createMockFlow<RedirectFlow>({ [method]: vi.fn().mockReturnValue(resolvedValue) });
		await mockInitFlow(flow);

		const { useStrivacity } = await import('../../src/runtime/composables/use-strivacity');
		const ctx = useStrivacity<RedirectFlow>();

		const result = await (ctx[method] as (...a: Array<unknown>) => unknown)(...args);

		expect(flow[method as keyof RedirectFlow]).toHaveBeenCalledWith(...args);
		expect(result).toEqual(resolvedValue);
	});
});

describe('useSession', () => {
	test('reads/writes the "strivacity_session" nuxt state key', async () => {
		const useState = vi.fn((_key: string, init: () => unknown) => ({ value: init() }));
		vi.doMock('#imports', () => ({ useState }));

		const { useSession } = await import('../../src/runtime/composables/use-session');
		const session = useSession();

		expect(useState).toHaveBeenCalledWith('strivacity_session', expect.any(Function));
		expect(session.value).toBeUndefined();

		vi.doUnmock('#imports');
	});
});

describe('useNativeLoginContext', () => {
	test('throws when used outside of a native login session', async () => {
		const { useNativeLoginContext } = await import('../../src/runtime/composables/use-native-login-context');

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
		await mockInitFlow(createMockFlow<NativeFlow>());

		const { useNativeLoginContext } = await import('../../src/runtime/composables/use-native-login-context');
		const { useNativeLogin } = await import('../../src/runtime/composables/use-native-login');

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
		await mountWithNativeLogin(sdk);

		await flushPromises();

		expect(sdk.init).toHaveBeenCalledTimes(1);
		expect(sdk.startSession).toHaveBeenCalledWith({});
	});

	test('forwards the given login params to sdk.startSession', async () => {
		const sdk = createMockFlow<NativeFlow>();
		await mountWithNativeLogin(sdk, { params: { sessionId: 'session-1', language: 'hu-HU' } });

		await flushPromises();

		expect(sdk.startSession).toHaveBeenCalledWith({ sessionId: 'session-1', language: 'hu-HU' });
	});

	test('is loading until sdk.startSession resolves with a state that has no pending finalizeUrl', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const { login } = await mountWithNativeLogin(sdk);

		expect(login.loading.value).toBe(true);

		await flushPromises();

		expect(login.loading.value).toBe(false);
	});

	test('stays loading forever if sdk.startSession resolves with no state at all', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue(undefined);
		const { login } = await mountWithNativeLogin(sdk);

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

		const { login } = await mountWithNativeLogin(sdk, { onGlobalMessage });
		await flushPromises();

		expect(onGlobalMessage).toHaveBeenCalledWith({ type: 'info', text: 'Welcome' });
		expect(login.forms.value).toEqual({ form1: {} });
		expect(login.messages.value).toEqual({ form1: { field1: { type: 'error', text: 'Required' } } });
		expect(login.state.value).toEqual(state);
	});

	test('keeps loading while a finalizeUrl is still pending', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ finalizeUrl: 'https://brandtegrity.io/finalize' });

		const { login } = await mountWithNativeLogin(sdk);
		await flushPromises();

		expect(login.loading.value).toBe(true);
	});

	test('calls onLogin and leaves the tracked state untouched when the sdk already has a session', async () => {
		const session = { access_token: 'access-token' } as unknown as SessionData;
		vi.doMock('../../src/runtime/composables/use-session', () => ({ useSession: () => ({ value: session }) }));

		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const onLogin = vi.fn();

		const { login } = await mountWithNativeLogin(sdk, { onLogin });
		await flushPromises();

		expect(onLogin).toHaveBeenCalledWith(session);
		expect(login.state.value).toEqual({});
	});

	test('routes a FallbackError from sdk.startSession to onFallback and logs it', async () => {
		// FallbackError must come from the same dynamic-import generation as the composable under
		// test (see beforeEach) - a top-level static import would be a different class instance
		// after vi.resetModules(), failing the instanceof check inside use-native-login.ts.
		const { FallbackError } = await import('@strivacity/sdk-core/utils/errors');
		const sdk = createMockFlow<NativeFlow>();
		const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
		vi.mocked(sdk.startSession).mockRejectedValue(fallbackError);
		const onFallback = vi.fn();

		const { login } = await mountWithNativeLogin(sdk, { onFallback });
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

		await mountWithNativeLogin(sdk, { onError });
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

			const { login } = await mountWithNativeLogin(sdk);
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

			const { login } = await mountWithNativeLogin(sdk);
			await flushPromises();

			await login.submitForm('form1', { raw: true });

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { raw: true });
		});

		test('routes a FallbackError to onFallback', async () => {
			// see the same-generation note on the sibling FallbackError test above
			const { FallbackError } = await import('@strivacity/sdk-core/utils/errors');
			const sdk = createMockFlow<NativeFlow>();
			const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
			vi.mocked(sdk.submitForm).mockRejectedValue(fallbackError);
			const onFallback = vi.fn();

			const { login } = await mountWithNativeLogin(sdk, { onFallback });
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

			const { login } = await mountWithNativeLogin(sdk, { onError });
			await flushPromises();

			await login.submitForm('form1');

			expect(onError).toHaveBeenCalledWith(error);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Error submitting form', error);
		});
	});

	test('setFormValue coerces empty strings to null and lazily creates the form bucket', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { login } = await mountWithNativeLogin(sdk);
		await flushPromises();

		login.setFormValue('newForm', 'field', 'value');
		login.setFormValue('newForm', 'other', '');

		expect(login.forms.value.newForm).toEqual({ field: 'value', other: null });
	});

	test('setMessage lazily creates the message bucket for a form', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { login } = await mountWithNativeLogin(sdk);
		await flushPromises();

		login.setMessage('newForm', 'field', { type: 'error', text: 'Required' });

		expect(login.messages.value.newForm).toEqual({ field: { type: 'error', text: 'Required' } });
	});

	describe('triggerFallback', () => {
		test('throws when no hosted URL is known yet', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
			const { login } = await mountWithNativeLogin(sdk);
			await flushPromises();

			expect(() => login.triggerFallback()).toThrow('No hosted URL provided');
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error', expect.any(Error));
		});

		test('calls onFallback with a FallbackError built from the known hosted URL', async () => {
			// see the same-generation note on the sibling FallbackError test above
			const { FallbackError } = await import('@strivacity/sdk-core/utils/errors');
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ hostedUrl: 'https://brandtegrity.io/hosted', screen: 'identifier' });
			const onFallback = vi.fn();

			const { login } = await mountWithNativeLogin(sdk, { onFallback });
			await flushPromises();

			login.triggerFallback('manual trigger');

			expect(sdk.logging!.warn).toHaveBeenCalledWith('Triggering fallback due to: manual trigger');
			expect(onFallback).toHaveBeenCalledWith(expect.any(FallbackError));
			expect((onFallback.mock.calls[0][0] as FallbackErrorType).url.toString()).toBe('https://brandtegrity.io/hosted');
		});
	});

	test('triggerClose calls onClose and logs', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const onClose = vi.fn();
		const { login } = await mountWithNativeLogin(sdk, { onClose });
		await flushPromises();

		login.triggerClose();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(sdk.logging!.debug).toHaveBeenCalledWith('Triggering close');
	});
});
