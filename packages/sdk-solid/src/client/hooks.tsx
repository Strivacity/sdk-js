import type { Component } from 'solid-js';
import type { RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, LoginContext, SDKContext, UseNativeLoginOptions, WithAuthGuardOptions } from './types';
import { createContext, createEffect, createMemo, createSignal, onCleanup, onSettled, useContext, Show } from 'solid-js';
import { createNativeLoginController } from '@strivacity/sdk-core/utils';

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
 * @throws {Error} Solid's context-not-found error when called outside of a `StyAuthProvider` (the context has no default value).
 */
export const useStrivacity = <
	T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow,
>(): SDKContext<T> => {
	return useContext(STRIVACITY_SDK) as SDKContext<T>;
};

/**
 * A hook that manages a native login flow session. Wrap the returned value's consumers (e.g. a widget renderer) in `<STRIVACITY_LOGIN_CONTEXT value={ctx}>` so `useNativeLoginContext()` can read it.
 *
 * @param {UseNativeLoginOptions} [options] - Optional options for the login session.
 * @returns {LoginContext} The native login context.
 */
export function useNativeLogin(options: UseNativeLoginOptions = {}): LoginContext {
	const ctx = useStrivacity<NativeFlow>();
	const controller = createNativeLoginController(() => ctx.sdk, options);
	const [snapshot, setSnapshot] = createSignal(controller.getSnapshot());

	const loading = createMemo(() => snapshot().loading);
	const forms = createMemo(() => snapshot().forms);
	const messages = createMemo(() => snapshot().messages);
	const state = createMemo(() => snapshot().state);

	onSettled(() => void controller.start());
	onCleanup(controller.subscribe((next) => setSnapshot(() => next)));

	return {
		loading,
		forms,
		messages,
		state,
		triggerFallback: controller.triggerFallback,
		triggerClose: controller.triggerClose,
		submitForm: controller.submitForm,
		setFormValue: controller.setFormValue,
		setMessage: controller.setMessage,
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
		const ctx = useStrivacity();
		const [authenticated, setAuthenticated] = createSignal<boolean | null>(null);

		createEffect(
			() => ctx.loading(),
			(isLoading) => {
				if (isLoading) {
					return;
				}

				let disposed = false;

				void ctx.sdk.checkAuthentication().then((result) => {
					if (disposed) {
						return;
					}

					setAuthenticated(result);

					if (!result) {
						if (ctx.sdk.options.serverSessionUri && ctx.sdk.session) {
							return ctx.sdk.refresh();
						}

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
			<Show when={!ctx.loading() && authenticated()} fallback={options?.onLoading?.() ?? null}>
				<WrappedComponent {...props} />
			</Show>
		);
	};
}
