import type { SDKContext, LoginContext, UseNativeLoginOptions, NativeFlow, NativeFlowState, SessionData } from '../../src/client/types';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { STRIVACITY_SDK, STRIVACITY_LOGIN_CONTEXT, useStrivacity, useNativeLoginContext, useNativeLogin } from '../../src/client/hooks';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { mount, cleanupMounts, flush } from '../dom';

afterEach(() => {
	cleanupMounts();
});

function mountNativeLogin(sdk: NativeFlow, options: UseNativeLoginOptions = {}) {
	let latest!: LoginContext;

	function Probe() {
		latest = useNativeLogin(options);
		return null;
	}

	mount(() => (
		<STRIVACITY_SDK value={{ sdk } as unknown as SDKContext<NativeFlow>}>
			<Probe />
		</STRIVACITY_SDK>
	));

	return { getLogin: () => latest };
}

describe('useStrivacity', () => {
	// STRIVACITY_SDK is created via createContext<...>() with no default value, so Solid's own useContext() throws
	// before ever returning undefined when there's no provider in scope - useStrivacity's own `if (!context) throw
	// new Error('Missing SDK context')` guard is unreachable dead code here; the thrown error is Solid's, not the app's.
	test('throws when used outside of a Strivacity SDK provider', () => {
		function Consumer() {
			useStrivacity();
			return null;
		}

		expect(() => mount(() => <Consumer />)).toThrow(/context/i);
	});

	test('returns the context provided by the nearest STRIVACITY_SDK provider', () => {
		const context = { sdk: {} } as unknown as SDKContext<NativeFlow>;
		let received: SDKContext<NativeFlow> | undefined;

		function Consumer() {
			received = useStrivacity<NativeFlow>();
			return null;
		}

		mount(() => (
			<STRIVACITY_SDK value={context}>
				<Consumer />
			</STRIVACITY_SDK>
		));

		expect(received).toBe(context);
	});
});

describe('useNativeLoginContext', () => {
	// STRIVACITY_LOGIN_CONTEXT is likewise created with no default value, so - just like useStrivacity - reading it
	// outside a provider throws from within Solid's own useContext() rather than returning undefined.
	test('throws when used outside of a STRIVACITY_LOGIN_CONTEXT provider', () => {
		function Consumer() {
			useNativeLoginContext();
			return null;
		}

		expect(() => mount(() => <Consumer />)).toThrow(/context/i);
	});

	test('resolves to the value provided by the nearest STRIVACITY_LOGIN_CONTEXT provider', () => {
		const context = { loading: () => false } as unknown as LoginContext;
		let received: LoginContext | undefined;

		function Consumer() {
			received = useNativeLoginContext();
			return null;
		}

		mount(() => (
			<STRIVACITY_LOGIN_CONTEXT value={context}>
				<Consumer />
			</STRIVACITY_LOGIN_CONTEXT>
		));

		expect(received).toBe(context);
	});

	test('wiring the value returned by useNativeLogin into STRIVACITY_LOGIN_CONTEXT lets a descendant read the live session state', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		let readLoading: (() => boolean) | undefined;

		function Owner(props: { children: unknown }) {
			const ctx = useNativeLogin();

			return <STRIVACITY_LOGIN_CONTEXT value={ctx}>{props.children as never}</STRIVACITY_LOGIN_CONTEXT>;
		}
		function Consumer() {
			const ctx = useNativeLoginContext();
			readLoading = ctx.loading;
			return null;
		}

		mount(() => (
			<STRIVACITY_SDK value={{ sdk } as unknown as SDKContext<NativeFlow>}>
				<Owner>
					<Consumer />
				</Owner>
			</STRIVACITY_SDK>
		));

		expect(readLoading!()).toBe(true);

		await flushPromises();

		expect(readLoading!()).toBe(false);
	});
});

describe('useNativeLogin', () => {
	test('initializes the sdk and starts a session on mount, defaulting params to an empty object', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountNativeLogin(sdk);

		await flushPromises();

		expect(sdk.init).toHaveBeenCalledTimes(1);
		expect(sdk.startSession).toHaveBeenCalledWith({});
	});

	test('forwards the given login params to sdk.startSession', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountNativeLogin(sdk, { params: { sessionId: 'session-1', language: 'hu-HU' } });

		await flushPromises();

		expect(sdk.startSession).toHaveBeenCalledWith({ sessionId: 'session-1', language: 'hu-HU' });
	});

	test('is loading until sdk.startSession resolves with a state that has no pending finalizeUrl', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const { getLogin } = mountNativeLogin(sdk);

		expect(getLogin().loading()).toBe(true);

		await flushPromises();

		expect(getLogin().loading()).toBe(false);
	});

	test('stays loading forever if sdk.startSession resolves with no state at all', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue(undefined);
		const { getLogin } = mountNativeLogin(sdk);

		await flushPromises();

		expect(getLogin().loading()).toBe(true);
	});

	test('keeps loading while a finalizeUrl is still pending', async () => {
		const sdk = createMockFlow<NativeFlow>();
		vi.mocked(sdk.startSession).mockResolvedValue({ finalizeUrl: 'https://brandtegrity.io/finalize' });
		const { getLogin } = mountNativeLogin(sdk);

		await flushPromises();

		expect(getLogin().loading()).toBe(true);
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
		await flushPromises();

		expect(onGlobalMessage).toHaveBeenCalledWith({ type: 'info', text: 'Welcome' });
		expect(getLogin().forms()).toEqual({ form1: {} });
		expect(getLogin().messages()).toEqual({ form1: { field1: { type: 'error', text: 'Required' } } });
		expect(getLogin().state()).toEqual(state);
	});

	test('calls onLogin and leaves the tracked state untouched when the sdk already has a session', async () => {
		const session = { access_token: 'access-token' } as unknown as SessionData;
		const sdk = createMockFlow<NativeFlow>({ session });
		vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
		const onLogin = vi.fn();

		const { getLogin } = mountNativeLogin(sdk, { onLogin });
		await flushPromises();

		expect(onLogin).toHaveBeenCalledWith(session);
		expect(getLogin().state()).toEqual({});
	});

	// NOTE: unlike sdk-react's useNativeLogin, the mount effect here has no `.catch()` around `sdk.init()` itself
	// (only around the `startSession(...)` call chained onto its `.then()`), so an `init()` rejection surfaces as an
	// unhandled promise rejection instead of being routed to `onError` - not meaningfully testable without asserting
	// on an unhandled rejection, so it's intentionally left uncovered here.

	test('routes a FallbackError from sdk.startSession to onFallback and logs it', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
		vi.mocked(sdk.startSession).mockRejectedValue(fallbackError);
		const onFallback = vi.fn();

		mountNativeLogin(sdk, { onFallback });
		await flushPromises();

		expect(onFallback).toHaveBeenCalledWith(fallbackError);
		expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
	});

	test('routes a non-fallback error from sdk.startSession to onError and logs it', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const error = new Error('network down');
		vi.mocked(sdk.startSession).mockRejectedValue(error);
		const onError = vi.fn();

		mountNativeLogin(sdk, { onError });
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

			const { getLogin } = mountNativeLogin(sdk);
			await flushPromises();

			getLogin().setFormValue('form1', 'address.city', 'Budapest');
			flush();
			getLogin().setFormValue('form1', 'address.zip', '');
			flush();

			await getLogin().submitForm('form1');

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { address: { city: 'Budapest', zip: null } });
			expect(getLogin().state()).toEqual({
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
			await flushPromises();

			await getLogin().submitForm('form1', { raw: true });

			expect(sdk.submitForm).toHaveBeenCalledWith('form1', { raw: true });
		});

		test('routes a FallbackError to onFallback', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const fallbackError = new FallbackError(new URL('https://brandtegrity.io/hosted'));
			vi.mocked(sdk.submitForm).mockRejectedValue(fallbackError);
			const onFallback = vi.fn();

			const { getLogin } = mountNativeLogin(sdk, { onFallback });
			await flushPromises();

			await getLogin().submitForm('form1');

			expect(onFallback).toHaveBeenCalledWith(fallbackError);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error occurred', fallbackError);
		});

		test('routes a non-fallback error to onError', async () => {
			const sdk = createMockFlow<NativeFlow>();
			const error = new Error('submit failed');
			vi.mocked(sdk.submitForm).mockRejectedValue(error);
			const onError = vi.fn();

			const { getLogin } = mountNativeLogin(sdk, { onError });
			await flushPromises();

			await getLogin().submitForm('form1');

			expect(onError).toHaveBeenCalledWith(error);
			expect(sdk.logging!.error).toHaveBeenCalledWith('Error submitting form', error);
		});
	});

	test('setFormValue coerces empty strings to null and lazily creates the form bucket', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { getLogin } = mountNativeLogin(sdk);
		await flushPromises();

		getLogin().setFormValue('newForm', 'field', 'value');
		flush();
		getLogin().setFormValue('newForm', 'other', '');
		flush();

		expect(getLogin().forms().newForm).toEqual({ field: 'value', other: null });
	});

	test('setMessage lazily creates the message bucket for a form', async () => {
		const sdk = createMockFlow<NativeFlow>();
		const { getLogin } = mountNativeLogin(sdk);
		await flushPromises();

		getLogin().setMessage('newForm', 'field', { type: 'error', text: 'Required' });
		flush();

		expect(getLogin().messages().newForm).toEqual({ field: { type: 'error', text: 'Required' } });
	});

	describe('triggerFallback', () => {
		test('throws when no hosted URL is known yet', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ screen: 'identifier' });
			const { getLogin } = mountNativeLogin(sdk);
			await flushPromises();

			expect(() => getLogin().triggerFallback()).toThrow('No hosted URL provided');
			expect(sdk.logging!.error).toHaveBeenCalledWith('Fallback error', expect.any(Error));
		});

		test('calls onFallback with a FallbackError built from the known hosted URL', async () => {
			const sdk = createMockFlow<NativeFlow>();
			vi.mocked(sdk.startSession).mockResolvedValue({ hostedUrl: 'https://brandtegrity.io/hosted', screen: 'identifier' });
			const onFallback = vi.fn();

			const { getLogin } = mountNativeLogin(sdk, { onFallback });
			await flushPromises();

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
		await flushPromises();

		getLogin().triggerClose();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(sdk.logging!.debug).toHaveBeenCalledWith('Triggering close');
	});

	test('disposing the owning component runs the mount-effect cleanup without throwing', async () => {
		const sdk = createMockFlow<NativeFlow>();
		mountNativeLogin(sdk);
		await flushPromises();

		expect(() => cleanupMounts()).not.toThrow();
	});
});
