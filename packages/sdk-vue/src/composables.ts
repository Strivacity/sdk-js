import type { InjectionKey } from 'vue';
import type { RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, NativeFlowState, NativeFlowMessage } from '@strivacity/sdk-core/types';
import type { LoginContext, SDKContext, UseNativeLoginOptions } from './types';
import { provide, inject, ref, onMounted, onUnmounted } from 'vue';
import { createNativeLoginController } from '@strivacity/sdk-core/utils';

export const STRIVACITY_SDK: InjectionKey<SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>> = Symbol('strivacity-sdk');
export const STRIVACITY_LOGIN_CONTEXT: InjectionKey<LoginContext> = Symbol('strivacity-login-context');

/**
 * A composable to access the Strivacity SDK context.
 *
 * @template T - The type of the Strivacity SDK flow (RedirectFlow, PopupFlow, NativeFlow, or EmbeddedFlow).
 * @returns {SDKContext<T>} - The Strivacity SDK context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export const useStrivacity = <
	T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow,
>(): SDKContext<T> => {
	const context = inject<SDKContext<T>>(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing SDK context');
	}

	return context;
};

/**
 * A composable to access the Strivacity SDK context specifically for native login flow.
 *
 * @returns {LoginContext} - The native flow context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export const useNativeLoginContext = (): LoginContext => {
	const context = inject<LoginContext>(STRIVACITY_LOGIN_CONTEXT);

	if (!context) {
		throw new Error('Missing SDK native login context');
	}

	return context;
};

/**
 * A composable that manages a native login flow session.
 *
 * @param {UseNativeLoginOptions} [options] - Optional options for the login session.
 * @returns {LoginContext} - The native flow context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export function useNativeLogin(options: UseNativeLoginOptions = {}): ReturnType<typeof useNativeLoginContext> {
	const { sdk } = useStrivacity<NativeFlow>();
	const controller = createNativeLoginController(() => sdk, options);
	const snapshot = controller.getSnapshot();

	const loading = ref<boolean>(snapshot.loading);
	const forms = ref<Record<string, Record<string, unknown>>>(snapshot.forms);
	const messages = ref<Record<string, Record<string, NativeFlowMessage>>>(snapshot.messages);
	const state = ref<Partial<NativeFlowState>>(snapshot.state);

	const unsubscribe = controller.subscribe((next) => {
		loading.value = next.loading;
		forms.value = next.forms;
		messages.value = next.messages;
		state.value = next.state;
	});

	onMounted(() => controller.start());
	onUnmounted(unsubscribe);

	const context: LoginContext = {
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

	provide<LoginContext>(STRIVACITY_LOGIN_CONTEXT, context);

	return context;
}
