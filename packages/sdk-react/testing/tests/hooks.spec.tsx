import type { SDKContext, LoginContext, UseNativeLoginOptions, NativeFlow, NativeFlowState, SessionData } from '../../src/types';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { STRIVACITY_SDK, useStrivacity, useNativeLoginContext, useNativeLogin } from '../../src/hooks';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { mount, cleanupMounts, flush, act } from '../utils/common';

afterEach(() => {
	cleanupMounts();
});

function mountNativeLogin(sdk: NativeFlow, options: UseNativeLoginOptions = {}) {
	let latest!: LoginContext;

	function Probe() {
		latest = useNativeLogin(options);
		return null;
	}

	mount(
		<STRIVACITY_SDK.Provider value={{ sdk } as unknown as SDKContext<NativeFlow>}>
			<Probe />
		</STRIVACITY_SDK.Provider>,
	);

	return { getLogin: () => latest };
}

describe('useStrivacity', () => {
	test('throws when used outside of a Strivacity SDK provider', () => {
		function Consumer() {
			useStrivacity();
			return null;
		}

		expect(() => mount(<Consumer />)).toThrow('Missing SDK context');
	});

	test('returns the context provided by the nearest STRIVACITY_SDK provider', () => {
		const context = { sdk: {} } as unknown as SDKContext<NativeFlow>;
		let received: SDKContext<NativeFlow> | undefined;

		function Consumer() {
			received = useStrivacity<NativeFlow>();
			return null;
		}

		mount(
			<STRIVACITY_SDK.Provider value={context}>
				<Consumer />
			</STRIVACITY_SDK.Provider>,
		);

		expect(received).toBe(context);
	});
});

describe('useNativeLoginContext', () => {
	test('returns the default context when no native login session is active', () => {
		function Consumer() {
			const ctx = useNativeLoginContext();
			return <div data-testid="loading">{String(ctx.loading)}</div>;
		}

		const { container } = mount(<Consumer />);

		expect(container.textContent).toBe('true');
	});

	test('resolves to the live context published by an active useNativeLogin call', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });

		let injectedLoading: string | undefined;

		function Owner() {
			useNativeLogin();
			return null;
		}
		function Consumer() {
			const ctx = useNativeLoginContext();
			injectedLoading = String(ctx.loading);
			return null;
		}

		mount(
			<STRIVACITY_SDK.Provider value={{ sdk } as unknown as SDKContext<NativeFlow>}>
				<Owner />
				<Consumer />
			</STRIVACITY_SDK.Provider>,
		);
		await flush();

		expect(injectedLoading).toBe('false');
	});

	test('resets to the default context once the owning useNativeLogin component unmounts', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });

		function Owner() {
			useNativeLogin();
			return null;
		}

		mount(
			<STRIVACITY_SDK.Provider value={{ sdk } as unknown as SDKContext<NativeFlow>}>
				<Owner />
			</STRIVACITY_SDK.Provider>,
		);
		await flush();

		cleanupMounts();

		function Consumer() {
			const ctx = useNativeLoginContext();
			return <div>{String(ctx.loading)}</div>;
		}

		const { container } = mount(<Consumer />);

		expect(container.textContent).toBe('true');
	});
});

describe('useNativeLogin', () => {
	test('initializes the sdk and starts a session on mount, defaulting params to an empty object', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountNativeLogin(sdk);

		await flush();

		expect(sdk.init).toHaveBeenCalledTimes(1);
		expect(sdk.startSession).toHaveBeenCalledWith({});
	});

	test('does nothing when there is no sdk instance yet', async () => {
		let latest!: LoginContext;

		function Probe() {
			latest = useNativeLogin();
			return null;
		}

		mount(
			<STRIVACITY_SDK.Provider value={{ sdk: undefined } as unknown as SDKContext<NativeFlow>}>
				<Probe />
			</STRIVACITY_SDK.Provider>,
		);
		await flush();

		expect(latest.loading).toBe(true);
	});

	test('routes an sdk.init() rejection to onError, logs it, and stops loading', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const error = new Error('init failed');
		vi.mocked(sdk.init).mockRejectedValue(error);
		const onError = vi.fn();

		const { getLogin } = mountNativeLogin(sdk, { onError });
		await flush();

		expect(onError).toHaveBeenCalledWith(error);
		expect(sdk.logging!.error).toHaveBeenCalledWith('Error initializing SDK', error);
		expect(getLogin().loading).toBe(false);
		expect(sdk.startSession).not.toHaveBeenCalled();
	});

	test('forwards the given login params to sdk.startSession', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountNativeLogin(sdk, { params: { sessionId: 'session-1', language: 'hu-HU' } });

		await flush();

		expect(sdk.startSession).toHaveBeenCalledWith({ sessionId: 'session-1', language: 'hu-HU' });
	});

	test('is loading until sdk.startSession resolves with a state that has no pending finalizeUrl', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const { getLogin } = mountNativeLogin(sdk);

		expect(getLogin().loading).toBe(true);

		await flush();

		expect(getLogin().loading).toBe(false);
	});

	test('stays loading forever if sdk.startSession resolves with no state at all', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue(undefined);
		const { getLogin } = mountNativeLogin(sdk);

		await flush();

		expect(getLogin().loading).toBe(true);
	});

	test('keeps loading while a finalizeUrl is still pending', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ finalizeUrl: 'https://brandtegrity.io/finalize' });
		const { getLogin } = mountNativeLogin(sdk);

		await flush();

		expect(getLogin().loading).toBe(true);
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

		const { getLogin } = mountNativeLogin(sdk, { onGlobalMessage });
		await flush();

		expect(onGlobalMessage).toHaveBeenCalledWith({ type: 'info', text: 'Welcome' });
		expect(getLogin().forms).toEqual({ form1: {} });
		expect(getLogin().messages).toEqual({ form1: { field1: { type: 'error', text: 'Required' } } });
		expect(getLogin().state).toEqual(state);
	});

	test('calls onLogin and leaves the tracked state untouched when the sdk already has a session', async () => {
		const session = { access_token: 'access-token' } as unknown as SessionData;
		const sdk = createMockFlow<NativeFlow>({ session });
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const onLogin = vi.fn();

		const { getLogin } = mountNativeLogin(sdk, { onLogin });
		await flush();

		expect(onLogin).toHaveBeenCalledWith(session);
		expect(getLogin().state).toEqual({});
	});

	test('routes a FallbackError from sdk.startSession to onFallback and logs it', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
		vi.mocked(sdk.startSession).mockRejectedValue(fallbackError);
		const onFallback = vi.fn();

		mountNativeLogin(sdk, { onFallback });
		await flush();

		expect(onFallback).toHaveBeenCalledWith(fallbackError);
		expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
	});

	test('routes a non-fallback error from sdk.startSession to onError and logs it', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const error = new Error('network down');
		vi.mocked(sdk.startSession).mockRejectedValue(error);
		const onError = vi.fn();

		mountNativeLogin(sdk, { onError });
		await flush();

		expect(onError).toHaveBeenCalledWith(error);
		expect(sdk.logging!.error).toHaveBeenCalledWith('Error starting session', error);
	});

	describe('submitForm', () => {
		test('unflattens the tracked form values and calls through to sdk.submitForm', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const initialForms = [{ id: 'form1', type: 'form' as const, widgets: [] }];
			vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier', forms: initialForms });
			vi.mocked(sdk.submitForm).mockResolvedValue({ screen: 'done' });

			const { getLogin } = mountNativeLogin(sdk);
			await flush();

			act(() => {
				getLogin().setFormValue('form1', 'address.city', 'Budapest');
				getLogin().setFormValue('form1', 'address.zip', '');
			});

			await act(async () => {
				await getLogin().submitForm('form1');
			});

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { address: { city: 'Budapest', zip: null } });
			expect(getLogin().state).toEqual({
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

			const { getLogin } = mountNativeLogin(sdk);
			await flush();

			await act(async () => {
				await getLogin().submitForm('form1', { raw: true });
			});

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { raw: true });
		});

		test('routes a FallbackError to onFallback', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
			vi.mocked(sdk.submitForm).mockRejectedValue(fallbackError);
			const onFallback = vi.fn();

			const { getLogin } = mountNativeLogin(sdk, { onFallback });
			await flush();

			await act(async () => {
				await getLogin().submitForm('form1');
			});

			expect(onFallback).toHaveBeenCalledWith(fallbackError);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
		});

		test('routes a non-fallback error to onError', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const error = new Error('submit failed');
			vi.mocked(sdk.submitForm).mockRejectedValue(error);
			const onError = vi.fn();

			const { getLogin } = mountNativeLogin(sdk, { onError });
			await flush();

			await act(async () => {
				await getLogin().submitForm('form1');
			});

			expect(onError).toHaveBeenCalledWith(error);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Error submitting form', error);
		});
	});

	test('setFormValue coerces empty strings to null and lazily creates the form bucket', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { getLogin } = mountNativeLogin(sdk);
		await flush();

		act(() => {
			getLogin().setFormValue('newForm', 'field', 'value');
		});
		act(() => {
			getLogin().setFormValue('newForm', 'other', '');
		});

		expect(getLogin().forms.newForm).toEqual({ field: 'value', other: null });
	});

	test('setMessage lazily creates the message bucket for a form', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { getLogin } = mountNativeLogin(sdk);
		await flush();

		act(() => {
			getLogin().setMessage('newForm', 'field', { type: 'error', text: 'Required' });
		});

		expect(getLogin().messages.newForm).toEqual({ field: { type: 'error', text: 'Required' } });
	});

	describe('triggerFallback', () => {
		test('throws when no hosted URL is known yet', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
			const { getLogin } = mountNativeLogin(sdk);
			await flush();

			expect(() => getLogin().triggerFallback()).toThrow('No hosted URL provided');
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error', expect.any(Error));
		});

		test('calls onFallback with a FallbackError built from the known hosted URL', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ hostedUrl: 'https://brandtegrity.io/hosted', screen: 'identifier' });
			const onFallback = vi.fn();

			const { getLogin } = mountNativeLogin(sdk, { onFallback });
			await flush();

			getLogin().triggerFallback('manual trigger');

			expect(sdk.logging!.warn).toHaveBeenCalledWith('Triggering fallback due to: manual trigger');
			expect(onFallback).toHaveBeenCalledWith(expect.any(FallbackError));
			expect((onFallback.mock.calls[0][0] as FallbackError).url.toString()).toBe('https://brandtegrity.io/hosted');
		});
	});

	test('triggerClose calls onClose and logs', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const onClose = vi.fn();
		const { getLogin } = mountNativeLogin(sdk, { onClose });
		await flush();

		getLogin().triggerClose();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(sdk.logging!.debug).toHaveBeenCalledWith('Triggering close');
	});
});
