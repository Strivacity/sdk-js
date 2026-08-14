import { getContext, setContext, onMount, onDestroy } from 'svelte';
import { SvelteURL } from 'svelte/reactivity';
import type { RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, NativeParams, LoginFlowState, LoginFlowMessage } from '@strivacity/sdk-core/types';
import type { LoginContext, SDKContext, UseNativeLoginOptions } from '../types';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { unflattenObject } from '@strivacity/sdk-core/utils';

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
		throw new Error('Missing Strivacity SDK context');
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
		throw new Error('Missing Strivacity SDK native login context');
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
	const abortController = new AbortController();
	const ctx = useStrivacity<NativeFlow>();

	let loading = $state<boolean>(true);
	let forms = $state<Record<string, Record<string, unknown>>>({});
	let messages = $state<Record<string, Record<string, LoginFlowMessage>>>({});
	let state = $state<Partial<LoginFlowState>>({});

	onMount(async () => {
		await ctx.init();

		try {
			await startSession(options.params);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			ctx.sdk.logging?.error('Error fetching authorization URI', error as Error);
			void options.onError?.(error as Error);
			loading = false;
		}
	});

	onDestroy(() => {
		abortController.abort();
	});

	async function startSession(loginParams: NativeParams = {}) {
		try {
			loading = true;

			const nextState = await ctx.sdk.startSession(loginParams);

			if (nextState) {
				await handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				ctx.sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				ctx.sdk.logging?.error('Error starting session', error as Error);
				void options.onError?.(error as Error);
			}
		}
	}

	async function handleResponse(nextState: Partial<LoginFlowState>) {
		if (ctx.sdk.session) {
			return await options.onLogin?.(ctx.sdk.session);
		}

		const newState: LoginFlowState = {
			hostedUrl: nextState?.hostedUrl ?? state.hostedUrl,
			finalizeUrl: nextState?.finalizeUrl ?? state.finalizeUrl,
			screen: nextState?.screen ?? state.screen,
			forms: nextState?.forms ?? state.forms,
			layout: nextState?.layout ?? state.layout,
			messages: nextState?.messages ?? {},
			branding: nextState?.branding ?? state.branding,
		};

		if (newState.screen !== state.screen) {
			forms = {};
			messages = {};

			for (const form of newState.forms ?? []) {
				forms[form.id] = {};
				messages[form.id] = {};
			}
		} else {
			ctx.sdk.logging?.info(`Updating screen: ${newState.screen}`);
		}

		Object.keys(newState.messages ?? {}).forEach((formId) => {
			if (formId === 'global') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
				void options.onGlobalMessage?.(newState.messages?.global!);
			} else {
				messages[formId] = newState.messages![formId] ?? {};
			}
		});

		state = newState;

		if (!newState.finalizeUrl) {
			loading = false;
		}
	}

	function triggerFallback(message?: string) {
		ctx.sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

		if (!state.hostedUrl) {
			const error = new Error('No hosted URL provided');
			ctx.sdk.logging?.error('Fallback error', error);
			throw error;
		}

		void options.onFallback?.(new FallbackError(new SvelteURL(state.hostedUrl)));
	}

	function triggerClose() {
		ctx.sdk.logging?.debug('Triggering close');
		void options.onClose?.();
	}

	async function submitForm(formId: string, customBody?: Record<string, unknown>) {
		try {
			loading = true;

			const nextState = await ctx.sdk.submitForm(formId, customBody ?? unflattenObject(forms[formId] ?? {}));

			if (nextState) {
				await handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				ctx.sdk.logging?.error('Fallback error occurred', error);
				void options.onFallback?.(error);
			} else {
				ctx.sdk.logging?.error('Error submitting form', error as Error);
				void options.onError?.(error as Error);
			}
		}
	}

	function setFormValue(formId: string, widgetId: string, value: unknown) {
		if (forms[formId] === undefined) {
			forms[formId] = {};
		}

		forms[formId][widgetId] = value === '' ? null : value;
	}

	function setMessage(formId: string, widgetId: string, value: LoginFlowMessage) {
		if (messages[formId] === undefined) {
			messages[formId] = {};
		}

		messages[formId][widgetId] = value;
	}

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
		triggerFallback,
		triggerClose,
		submitForm,
		setFormValue,
		setMessage,
	};

	setContext(STRIVACITY_LOGIN_CONTEXT, context);

	return context;
}
