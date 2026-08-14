import type { InjectionKey } from 'vue';
import type { RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, NativeParams, LoginFlowState, LoginFlowMessage } from '@strivacity/sdk-core/types';
import type { LoginContext, SDKContext, UseNativeLoginOptions } from './types';
import { provide, inject, ref, onMounted, onUnmounted } from 'vue';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { unflattenObject } from '@strivacity/sdk-core/utils';

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
		throw new Error('Missing Strivacity SDK context');
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
		throw new Error('Missing Strivacity SDK native login context');
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
	const abortController = new AbortController();
	const { sdk } = useStrivacity<NativeFlow>();

	const loading = ref<boolean>(true);
	const forms = ref<Record<string, Record<string, unknown>>>({});
	const messages = ref<Record<string, Record<string, LoginFlowMessage>>>({});
	const state = ref<Partial<LoginFlowState>>({});

	onMounted(async () => {
		await sdk.init();

		try {
			await startSession(options.params);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			sdk.logging?.error('Error fetching authorization URI', error);
			void options.onError?.(error);
			loading.value = false;
		}
	});

	onUnmounted(() => abortController.abort());

	async function startSession(loginParams: NativeParams = {}) {
		try {
			loading.value = true;

			const nextState = await sdk.startSession(loginParams);

			if (nextState) {
				await handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				sdk.logging?.error('Error starting session', error);
				void options.onError?.(error);
			}
		}
	}

	async function handleResponse(nextState: Partial<LoginFlowState>) {
		if (sdk.session) {
			return await options.onLogin?.(sdk.session);
		}

		const newState: LoginFlowState = {
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

		Object.keys(newState.messages ?? {}).forEach((formId) => {
			if (formId === 'global') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
				void options.onGlobalMessage?.(newState.messages?.global!);
			} else {
				messages.value[formId] = newState.messages![formId] ?? {};
			}
		});

		state.value = newState;

		if (!newState.finalizeUrl) {
			loading.value = false;
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
				await handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				sdk.logging?.error('Error submitting form', error);
				void options.onError?.(error);
			}
		}
	}

	function setFormValue(formId: string, widgetId: string, value: unknown) {
		if (forms.value[formId] === undefined) {
			forms.value[formId] = {};
		}

		forms.value[formId][widgetId] = value === '' ? null : value;
	}

	function setMessage(formId: string, widgetId: string, value: LoginFlowMessage) {
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
