import type { Component } from 'solid-js';
import type {
	NativeFlowState,
	NativeFlowMessage,
	RedirectFlow,
	PopupFlow,
	EmbeddedFlow,
	NativeFlow,
	NativeParams,
	LoginContext,
	SDKContext,
	UseNativeLoginOptions,
	WithAuthGuardOptions,
} from './types';
import { createContext, createEffect, createSignal, onSettled, useContext, Show } from 'solid-js';
import { unflattenObject } from '@strivacity/sdk-core/utils';
import { FallbackError } from '../errors';

/**
 * Context carrying the Strivacity SDK instance and reactive session state. Scope it to your app with `<STRIVACITY_SDK value={...}>`.
 */
export const STRIVACITY_SDK = createContext<SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>>();

/**
 * Context carrying the native login flow state. Scope it to a widget tree with `<STRIVACITY_LOGIN_CONTEXT value={...}>` (the value returned by `useNativeLogin`).
 */
export const STRIVACITY_LOGIN_CONTEXT = createContext<LoginContext>();

/**
 * A hook to access the native login context.
 *
 * @returns {LoginContext} The native login context.
 */
export const useNativeLoginContext = (): LoginContext => {
	return useContext(STRIVACITY_LOGIN_CONTEXT);
};

/**
 * A hook to access the Strivacity SDK context.
 *
 * @template T - The type of the Strivacity SDK flow (RedirectFlow, PopupFlow, NativeFlow, or EmbeddedFlow).
 * @returns {SDKContext<T>} The Strivacity SDK context.
 */
export const useStrivacity = <
	T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow,
>(): SDKContext<T> => {
	const context = useContext(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing SDK context');
	}

	return context as SDKContext<T>;
};

/**
 * A hook that manages a native login flow session. Wrap the returned value's consumers (e.g. a widget renderer) in `<STRIVACITY_LOGIN_CONTEXT value={ctx}>` so `useNativeLoginContext()` can read it.
 *
 * @param {UseNativeLoginOptions} [options] - Optional options for the login session.
 * @returns {LoginContext} The native login context.
 */
export function useNativeLogin(options: UseNativeLoginOptions = {}): LoginContext {
	const { sdk } = useStrivacity<NativeFlow>();

	const [loading, setLoading] = createSignal<boolean>(true);
	const [forms, setForms] = createSignal<Record<string, Record<string, unknown>>>({});
	const [messages, setMessages] = createSignal<Record<string, Record<string, NativeFlowMessage>>>({});
	const [state, setState] = createSignal<Partial<NativeFlowState>>({});

	onSettled(() => {
		const abortController = new AbortController();

		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		sdk.init().then(() =>
			startSession(options.params).catch((error) => {
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}

				sdk.logging?.error('Error fetching authorization URI', error);
				void options.onError?.(error as Error);
				setLoading(false);
			}),
		);

		return () => {
			abortController.abort();
		};
	});

	function handleResponse(nextState: Partial<NativeFlowState>): void {
		if (sdk.session) {
			return void options.onLogin?.(sdk.session);
		}

		const currentState = state();
		const newState: NativeFlowState = {
			hostedUrl: nextState?.hostedUrl ?? currentState.hostedUrl,
			finalizeUrl: nextState?.finalizeUrl ?? currentState.finalizeUrl,
			screen: nextState?.screen ?? currentState.screen,
			forms: nextState?.forms ?? currentState.forms,
			layout: nextState?.layout ?? currentState.layout,
			messages: nextState?.messages ?? {},
			branding: nextState?.branding ?? currentState.branding,
		};

		const hasScreenChanged = newState.screen !== currentState.screen;

		if (hasScreenChanged) {
			const nextForms: Record<string, Record<string, unknown>> = {};
			const nextMessages: Record<string, Record<string, NativeFlowMessage>> = {};

			for (const form of newState.forms ?? []) {
				nextForms[form.id] = {};
				nextMessages[form.id] = {};
			}

			setForms(nextForms);
			setMessages(nextMessages);
		} else {
			sdk.logging?.info(`Updating screen: ${newState.screen}`);
		}

		const nextMessageMap = { ...messages() };

		for (const formId of Object.keys(newState.messages ?? {})) {
			if (formId === 'global') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
				void options.onGlobalMessage?.(newState.messages?.global!);
			} else {
				nextMessageMap[formId] = newState.messages![formId] ?? {};
			}
		}

		setMessages(nextMessageMap);
		setState(newState);

		if (!newState.finalizeUrl) {
			setLoading(false);
		}
	}

	async function startSession(loginParams: NativeParams = {}): Promise<void> {
		try {
			setLoading(true);

			const nextState = await sdk.startSession(loginParams);

			if (nextState) {
				handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				sdk.logging?.error('Error starting session', error);
				void options.onError?.(error as Error);
			}
		}
	}

	function triggerFallback(message?: string): void {
		sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

		const hostedUrl = state().hostedUrl;

		if (!hostedUrl) {
			const error = new Error('No hosted URL provided');
			sdk.logging?.error('Fallback error', error);
			throw error;
		}

		void options.onFallback?.(new FallbackError(new URL(hostedUrl)));
	}

	function triggerClose(): void {
		sdk.logging?.debug('Triggering close');
		void options.onClose?.();
	}

	async function submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void> {
		try {
			setLoading(true);

			const nextState = await sdk.submitForm(formId, customBody ?? unflattenObject(forms()[formId] ?? {}));

			if (nextState) {
				handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				sdk.logging?.error('Error submitting form', error);
				void options.onError?.(error as Error);
			}
		}
	}

	function setFormValue(formId: string, widgetId: string, value: unknown): void {
		setForms({
			...forms(),
			[formId]: {
				...(forms()[formId] ?? {}),
				[widgetId]: value === '' ? null : value,
			},
		});
	}

	function setMessage(formId: string, widgetId: string, value: NativeFlowMessage): void {
		setMessages({
			...messages(),
			[formId]: {
				...(messages()[formId] ?? {}),
				[widgetId]: value,
			},
		});
	}

	return {
		loading,
		forms,
		messages,
		state,
		triggerFallback,
		triggerClose,
		submitForm,
		setFormValue,
		setMessage,
	};
}

/**
 * A higher-order component that guards a component with authentication.
 * Waits for the SDK to finish loading, then redirects to the login page if the user is not authenticated.
 *
 * @param {Component<P>} WrappedComponent - The component to guard.
 * @param {WithAuthGuardOptions} [options] - Optional options for the auth guard.
 * @param {string} [options.loginUri='/login'] - The URI to redirect to if the user is not authenticated.
 * @returns {Component<P>} The guarded component.
 */
export function withAuthGuard<P extends object>(WrappedComponent: Component<P>, options?: WithAuthGuardOptions): Component<P> {
	return function AuthGuard(props: P) {
		const { loading, sdk } = useStrivacity();
		const [authenticated, setAuthenticated] = createSignal<boolean | null>(null);

		createEffect(
			() => loading(),
			(isLoading) => {
				if (isLoading) {
					return;
				}

				let disposed = false;

				void sdk.checkAuthentication().then((result) => {
					if (disposed) {
						return;
					}

					setAuthenticated(result);

					if (!result) {
						options ??= {};
						options.loginUri ??= '/login';
						globalThis.location.href = options.loginUri;
					}
				});

				return () => {
					disposed = true;
				};
			},
		);

		return (
			<Show when={!loading() && authenticated()} fallback={options?.onLoading?.() ?? null}>
				<WrappedComponent {...props} />
			</Show>
		);
	};
}
