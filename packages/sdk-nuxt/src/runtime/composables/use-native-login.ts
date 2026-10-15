import type { NativeFlow, NativeFlowState, NativeFlowMessage } from '@strivacity/sdk-core/types';
import type { LoginContext, UseNativeLoginOptions } from '../types';
import { STRIVACITY_LOGIN_CONTEXT, type useNativeLoginContext } from './use-native-login-context';
import { provide, ref, onMounted, onUnmounted } from 'vue';
import { createNativeLoginController } from '@strivacity/sdk-core/utils';
import { useStrivacity } from './use-strivacity';

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
