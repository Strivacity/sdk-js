import type { NativeFlow, NativeParams, NativeFlowState, NativeFlowMessage } from '@strivacity/sdk-core/types';
import type { LoginContext, UseNativeLoginOptions } from '../types';
import { STRIVACITY_LOGIN_CONTEXT, type useNativeLoginContext } from './use-native-login-context';
import { provide, ref, onMounted, onUnmounted } from 'vue';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { unflattenObject } from '@strivacity/sdk-core/utils';
import { useStrivacity } from './use-strivacity';

/**
 * A composable that manages a native login flow session.
 *
 * @param {UseNativeLoginOptions} [options] - Optional options for the login session.
 * @returns {LoginContext} - The native flow context.
 * @throws {Error} - If the Strivacity SDK context is not found.
 */
export function useNativeLogin(options: UseNativeLoginOptions = {}): ReturnType<typeof useNativeLoginContext> {
	const abortController = new AbortController();
	const { sdk } = useStrivacity<NativeFlow>();

	const loading = ref<boolean>(true);
	const forms = ref<Record<string, Record<string, unknown>>>({});
	const messages = ref<Record<string, Record<string, NativeFlowMessage>>>({});
	const state = ref<Partial<NativeFlowState>>({});

	onMounted(async () => {
		await sdk.init();

		try {
			await startSession(options.params);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			sdk.logging?.error('Error fetching authorization URI', error as Error);
			void options.onError?.(error as Error);
			loading.value = false;
		}
	});

	onUnmounted(() => abortController.abort());

	function handleResponse(nextState: Partial<NativeFlowState>) {
		if (sdk.session) {
			return void options.onLogin?.(sdk.session);
		}

		const newState: NativeFlowState = {
			hostedUrl: nextState?.hostedUrl ?? state.value.hostedUrl,
			finalizeUrl: nextState?.finalizeUrl ?? state.value.finalizeUrl,
			screen: nextState?.screen ?? state.value.screen,
			forms: nextState?.forms ?? state.value.forms,
			layout: nextState?.layout ?? state.value.layout,
			messages: nextState?.messages ?? {},
			branding: nextState?.branding ?? state.value.branding,
		};

		if (newState.screen !== state.value.screen) {
			forms.value = {};
			messages.value = {};

			for (const form of newState.forms ?? []) {
				forms.value[form.id] = {};
				messages.value[form.id] = {};
			}
		} else {
			sdk.logging?.info(`Updating screen: ${newState.screen}`);
		}

		for (const formId of Object.keys(newState.messages ?? {})) {
			if (formId === 'global') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
				void options.onGlobalMessage?.(newState.messages?.global!);
			} else {
				messages.value[formId] = newState.messages![formId] ?? {};
			}
		}

		state.value = newState;

		if (!newState.finalizeUrl) {
			loading.value = false;
		}
	}

	async function startSession(loginParams: NativeParams = {}) {
		try {
			loading.value = true;

			const nextState = await sdk.startSession(loginParams);

			if (nextState) {
				handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				sdk.logging?.error('Error starting session', error as Error);
				void options.onError?.(error as Error);
			}
		}
	}

	function triggerFallback(message?: string) {
		sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

		if (!state.value.hostedUrl) {
			const error = new Error('No hosted URL provided');
			sdk.logging?.error('Fallback error', error);
			throw error;
		}

		void options.onFallback?.(new FallbackError(new URL(state.value.hostedUrl)));
	}

	function triggerClose() {
		sdk.logging?.debug('Triggering close');
		void options.onClose?.();
	}

	async function submitForm(formId: string, customBody?: Record<string, unknown>) {
		try {
			loading.value = true;

			const nextState = await sdk.submitForm(formId, customBody ?? unflattenObject(forms.value[formId] ?? {}));

			if (nextState) {
				handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				sdk.logging?.error('Error submitting form', error as Error);
				void options.onError?.(error as Error);
			}
		}
	}

	function setFormValue(formId: string, widgetId: string, value: unknown) {
		if (forms.value[formId] === undefined) {
			forms.value[formId] = {};
		}

		forms.value[formId][widgetId] = value === '' ? null : value;
	}

	function setMessage(formId: string, widgetId: string, value: NativeFlowMessage) {
		if (messages.value[formId] === undefined) {
			messages.value[formId] = {};
		}

		messages.value[formId][widgetId] = value;
	}

	provide<LoginContext>(STRIVACITY_LOGIN_CONTEXT, {
		loading,
		forms,
		messages,
		state,
		triggerFallback,
		triggerClose,
		submitForm,
		setFormValue,
		setMessage,
	});

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
