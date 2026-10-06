import type {
	NativeFlow,
	NativeFlowMessage,
	NativeFlowState,
	NativeLoginController,
	NativeLoginControllerOptions,
	NativeLoginSnapshot,
	NativeParams,
} from '../types';
import { unflattenObject } from './common';
import { FallbackError } from './errors';
import { isSessionExpired } from './session';

/**
 * Creates the framework-agnostic state machine of a native login flow (`mode: 'native'`).
 *
 * The controller owns the flow state (loading flag, form values, messages, IdP state) and publishes it as immutable snapshots.
 * Framework integrations only bind `subscribe`/`getSnapshot` to their own reactivity and call `start()` when the login UI mounts.
 *
 * @param {() => NativeFlow} getSdk - Returns the native flow SDK instance. Called on every use, so the instance may be created or
 *   replaced after the controller (e.g. by a provider that initializes the SDK later).
 * @param {NativeLoginControllerOptions} [options] - Callbacks and session parameters. Can be replaced later with `setOptions`.
 * @returns {NativeLoginController} The controller.
 */
export function createNativeLoginController(getSdk: () => NativeFlow, options: NativeLoginControllerOptions = {}): NativeLoginController {
	const listeners = new Set<(snapshot: NativeLoginSnapshot) => void>();
	let currentOptions = options;
	let snapshot: NativeLoginSnapshot = { loading: true, forms: {}, messages: {}, state: {} };

	const update = (patch: Partial<NativeLoginSnapshot>) => {
		snapshot = { ...snapshot, ...patch };

		for (const listener of listeners) {
			listener(snapshot);
		}
	};

	const handleError = (error: unknown, message: string) => {
		const logging = getSdk().logging;

		if (error instanceof FallbackError) {
			logging?.error('Fallback error occurred', error);
			void currentOptions.onFallback?.(error);
		} else {
			logging?.error(message, error as Error);
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			void currentOptions.onError?.(error as Error);
		}
	};

	const handleResponse = async (nextState: Partial<NativeFlowState>) => {
		const flow = getSdk();

		if (flow.session && !isSessionExpired(flow.session)) {
			return await currentOptions.onLogin?.(flow.session);
		}

		const state = snapshot.state;
		const newState: NativeFlowState = {
			hostedUrl: nextState?.hostedUrl ?? state.hostedUrl,
			finalizeUrl: nextState?.finalizeUrl ?? state.finalizeUrl,
			screen: nextState?.screen ?? state.screen,
			forms: nextState?.forms ?? state.forms,
			layout: nextState?.layout ?? state.layout,
			messages: nextState?.messages ?? {},
			branding: nextState?.branding ?? state.branding,
		};

		let forms = snapshot.forms;
		let messages = { ...snapshot.messages };

		if (newState.screen !== state.screen) {
			forms = {};
			messages = {};

			for (const form of newState.forms ?? []) {
				forms[form.id] = {};
				messages[form.id] = {};
			}
		} else {
			flow.logging?.info(`Updating screen: ${newState.screen}`);
		}

		for (const formId of Object.keys(newState.messages ?? {})) {
			if (formId === 'global') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
				void currentOptions.onGlobalMessage?.(newState.messages?.global!);
			} else {
				messages[formId] = newState.messages![formId] ?? {};
			}
		}

		update({
			forms,
			messages,
			state: newState,
			loading: newState.finalizeUrl ? snapshot.loading : false,
		});
	};

	const startSession = async (params: NativeParams = {}) => {
		try {
			update({ loading: true });

			const nextState = await getSdk().startSession(params);

			if (nextState) {
				await handleResponse(nextState);
			}
		} catch (error) {
			handleError(error, 'Error starting session');
		}
	};

	const submitForm = async (formId: string, customBody?: Record<string, unknown>) => {
		try {
			update({ loading: true });

			const nextState = await getSdk().submitForm(formId, customBody ?? unflattenObject(snapshot.forms[formId] ?? {}));

			if (nextState) {
				await handleResponse(nextState);
			}
		} catch (error) {
			handleError(error, 'Error submitting form');
		}
	};

	const start = async () => {
		try {
			await getSdk().init();
		} catch (error) {
			getSdk().logging?.error('Error initializing SDK', error);
			void currentOptions.onError?.(error as Error);
			update({ loading: false });
			return;
		}

		await startSession(currentOptions.params);
	};

	const triggerFallback = (message?: string) => {
		const logging = getSdk().logging;

		logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

		if (!snapshot.state.hostedUrl) {
			const error = new Error('No hosted URL provided');
			logging?.error('Fallback error', error);
			throw error;
		}

		void currentOptions.onFallback?.(new FallbackError(new URL(snapshot.state.hostedUrl)));
	};

	const triggerClose = () => {
		getSdk().logging?.debug('Triggering close');
		void currentOptions.onClose?.();
	};

	const setFormValue = (formId: string, widgetId: string, value: unknown) => {
		update({ forms: { ...snapshot.forms, [formId]: { ...snapshot.forms[formId], [widgetId]: value === '' ? null : value } } });
	};

	const setMessage = (formId: string, widgetId: string, value: NativeFlowMessage) => {
		update({ messages: { ...snapshot.messages, [formId]: { ...snapshot.messages[formId], [widgetId]: value } } });
	};

	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		setOptions: (nextOptions) => {
			currentOptions = nextOptions;
		},
		start,
		startSession,
		submitForm,
		triggerFallback,
		triggerClose,
		setFormValue,
		setMessage,
	};
}
