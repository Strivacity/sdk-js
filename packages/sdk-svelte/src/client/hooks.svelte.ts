import { getContext, setContext, onMount, onDestroy } from 'svelte';
import type { RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow } from '@strivacity/sdk-core/types';
import type { LoginContext, SDKContext, UseNativeLoginOptions } from '../types';
import { createNativeLoginController } from '@strivacity/sdk-core/utils';

export const STRIVACITY_SDK = Symbol('strivacity-sdk');
export const STRIVACITY_LOGIN_CONTEXT = Symbol('strivacity-login-context');

/**
 * Access the Strivacity SDK context.
 *
 * @template T - The type of the Strivacity SDK flow (RedirectFlow, PopupFlow, NativeFlow, or EmbeddedFlow).
 * @returns {SDKContext<T>} - The Strivacity SDK context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export const useStrivacity = <
	T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow,
>(): SDKContext<T> => {
	const context = getContext<SDKContext<T>>(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing SDK context');
	}

	return context;
};

/**
 * Access the Strivacity SDK context specifically for native login flow.
 *
 * @returns {LoginContext} - The native flow context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export const useNativeLoginContext = (): LoginContext => {
	const context = getContext<LoginContext>(STRIVACITY_LOGIN_CONTEXT);

	if (!context) {
		throw new Error('Missing SDK native login context');
	}

	return context;
};

/**
 * Manages a native login flow session.
 *
 * @param {UseNativeLoginOptions} [options] - Optional options for the login session.
 * @returns {LoginContext} - The native flow context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export function useNativeLogin(options: UseNativeLoginOptions = {}): LoginContext {
	const ctx = useStrivacity<NativeFlow>();
	const controller = createNativeLoginController(() => ctx.sdk, options);
	let snapshot = $state.raw(controller.getSnapshot());

	const loading = $derived(snapshot.loading);
	const forms = $derived(snapshot.forms);
	const messages = $derived(snapshot.messages);
	const state = $derived(snapshot.state);

	const unsubscribe = controller.subscribe((next) => {
		snapshot = next;
	});

	onMount(() => controller.start());
	onDestroy(unsubscribe);

	const context: LoginContext = {
		get loading() {
			return loading;
		},
		get forms() {
			return forms;
		},
		get messages() {
			return messages;
		},
		get state() {
			return state;
		},
		triggerFallback: controller.triggerFallback,
		triggerClose: controller.triggerClose,
		submitForm: controller.submitForm,
		setFormValue: controller.setFormValue,
		setMessage: controller.setMessage,
	};

	setContext(STRIVACITY_LOGIN_CONTEXT, context);

	return context;
}
