import type { ComponentType } from 'preact';
import type {
	LoginFlowState,
	LoginFlowMessage,
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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'preact/compat';
import { unflattenObject } from '@strivacity/sdk-core/utils';
import { FallbackError } from './errors';

export const STRIVACITY_SDK = createContext<SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>>(null!);

const loginContextListeners = new Set<() => void>();
const defaultLoginContext: LoginContext = {
	loading: true,
	forms: {},
	messages: {},
	state: {},
	triggerFallback: () => undefined,
	triggerClose: () => undefined,
	submitForm: async () => Promise.resolve(undefined),
	setFormValue: () => undefined,
	setMessage: () => undefined,
};
let currentLoginContext: LoginContext = defaultLoginContext;

const loginContextStore = {
	subscribe: (listener: () => void) => {
		loginContextListeners.add(listener);

		return () => {
			loginContextListeners.delete(listener);
		};
	},
	notify: () => {
		loginContextListeners.forEach((listener) => listener());
	},
	get: () => currentLoginContext,
	set: (context: LoginContext) => {
		currentLoginContext = context;
	},
};

/**
 * A custom hook to access the native login context.
 *
 * @returns {LoginContext} The native login context.
 */
export const useNativeLoginContext = (): LoginContext => {
	return useSyncExternalStore(loginContextStore.subscribe, loginContextStore.get);
};

/**
 * A custom hook to access the Strivacity SDK context.
 *
 * @template T - The type of the Strivacity SDK flow (RedirectFlow, PopupFlow, NativeFlow, or EmbeddedFlow).
 * @returns {SDKContext<T>} The Strivacity SDK context.
 */
export const useStrivacity = <
	T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow,
>(): SDKContext<T> => {
	const context = useContext(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing Strivacity SDK context');
	}

	return context as SDKContext<T>;
};

/**
 * A custom hook that manages a native login flow session.
 *
 * @param {UseNativeLoginOptions} [options] - Optional options for the login session.
 * @returns {LoginContext} The native login context.
 */
export function useNativeLogin(options: UseNativeLoginOptions = {}): ReturnType<typeof useNativeLoginContext> {
	const { sdk } = useStrivacity<NativeFlow>();
	const optionsRef = useRef(options);
	const stateRef = useRef<Partial<LoginFlowState>>({});

	const [loading, setLoading] = useState<boolean>(true);
	const [forms, setForms] = useState<Record<string, Record<string, unknown>>>({});
	const [messages, setMessages] = useState<Record<string, Record<string, LoginFlowMessage>>>({});
	const [state, setState] = useState<Partial<LoginFlowState>>({});

	useEffect(() => {
		optionsRef.current = options;
	}, [options]);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const handleResponse = useCallback(
		async (nextState: Partial<LoginFlowState>) => {
			if (sdk.session) {
				return await optionsRef.current.onLogin?.(sdk.session);
			}

			const newState: LoginFlowState = {
				hostedUrl: nextState?.hostedUrl ?? stateRef.current.hostedUrl,
				finalizeUrl: nextState?.finalizeUrl ?? stateRef.current.finalizeUrl,
				screen: nextState?.screen ?? stateRef.current.screen,
				forms: nextState?.forms ?? stateRef.current.forms,
				layout: nextState?.layout ?? stateRef.current.layout,
				messages: nextState?.messages ?? {},
				branding: nextState?.branding ?? stateRef.current.branding,
			};

			const hasScreenChanged = newState.screen !== stateRef.current.screen;

			if (hasScreenChanged) {
				const nextForms: Record<string, Record<string, unknown>> = {};
				const nextMessages: Record<string, Record<string, LoginFlowMessage>> = {};

				for (const form of newState.forms ?? []) {
					nextForms[form.id] = {};
					nextMessages[form.id] = {};
				}

				setForms(nextForms);
				setMessages(nextMessages);
			} else {
				sdk.logging?.info(`Updating screen: ${newState.screen}`);
			}

			setMessages((previousMessages) => {
				const nextMessageMap = { ...previousMessages };

				Object.keys(newState.messages ?? {}).forEach((formId) => {
					if (formId === 'global') {
						// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
						void optionsRef.current.onGlobalMessage?.(newState.messages?.global!);
					} else {
						nextMessageMap[formId] = newState.messages![formId] ?? {};
					}
				});

				return nextMessageMap;
			});
			setState(newState);

			if (!newState.finalizeUrl) {
				setLoading(false);
			}
		},
		[sdk],
	);

	const startSession = useCallback(
		async (loginParams: NativeParams = {}) => {
			try {
				setLoading(true);

				const nextState = await sdk.startSession(loginParams);

				if (nextState) {
					await handleResponse(nextState);
				}
			} catch (error) {
				if (error instanceof FallbackError) {
					sdk.logging?.error('Fallback error occurred', error);
					void optionsRef.current.onFallback?.(error);
				} else {
					sdk.logging?.error('Error starting session', error);
					void optionsRef.current.onError?.(error as Error);
				}
			}
		},
		[handleResponse, sdk],
	);

	const triggerFallback = useCallback(
		(message?: string) => {
			sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

			if (!stateRef.current.hostedUrl) {
				const error = new Error('No hosted URL provided');
				sdk.logging?.error('Fallback error', error);
				throw error;
			}

			void optionsRef.current.onFallback?.(new FallbackError(new URL(stateRef.current.hostedUrl)));
		},
		[sdk],
	);

	const triggerClose = useCallback(() => {
		sdk.logging?.debug('Triggering close');
		void optionsRef.current.onClose?.();
	}, [sdk]);

	const submitForm = useCallback(
		async (formId: string, customBody?: Record<string, unknown>) => {
			try {
				setLoading(true);

				const nextState = await sdk.submitForm(formId, customBody ?? unflattenObject(forms[formId] ?? {}));

				if (nextState) {
					await handleResponse(nextState);
				}
			} catch (error) {
				if (error instanceof FallbackError) {
					sdk.logging?.error('Fallback error occurred', error);
					void optionsRef.current.onFallback?.(error);
				} else {
					sdk.logging?.error('Error submitting form', error);
					void optionsRef.current.onError?.(error as Error);
				}
			}
		},
		[forms, handleResponse, sdk],
	);

	const setFormValue = useCallback((formId: string, widgetId: string, value: unknown) => {
		setForms((previousForms) => ({
			...previousForms,
			[formId]: {
				...(previousForms[formId] ?? {}),
				[widgetId]: value === '' ? null : value,
			},
		}));
	}, []);

	const setMessage = useCallback((formId: string, widgetId: string, value: LoginFlowMessage) => {
		setMessages((previousMessages) => ({
			...previousMessages,
			[formId]: {
				...(previousMessages[formId] ?? {}),
				[widgetId]: value,
			},
		}));
	}, []);

	useEffect(() => {
		if (!sdk) {
			return;
		}

		const abortController = new AbortController();

		sdk
			.init()
			.then(() => {
				startSession(optionsRef.current.params).catch((error) => {
					if (error instanceof DOMException && error.name === 'AbortError') {
						return;
					}

					sdk.logging?.error('Error fetching authorization URI', error);
					void optionsRef.current.onError?.(error as Error);
					setLoading(false);
				});
			})
			.catch((error) => {
				sdk.logging?.error('Error initializing SDK', error);
				void optionsRef.current.onError?.(error as Error);
				setLoading(false);
			});

		return () => {
			abortController.abort();
		};
	}, [sdk, startSession]);

	const ctx = useMemo(
		() => ({
			loading,
			forms,
			messages,
			state,
			triggerFallback,
			triggerClose,
			submitForm,
			setFormValue,
			setMessage,
		}),
		[loading, forms, messages, state, triggerFallback, triggerClose, submitForm, setFormValue, setMessage],
	);

	// Publish synchronously during render (not only in an effect): WidgetRenderer/widgets are descendants rendered in this same synchronous pass and read this store via useNativeLoginContext();
	// If we only wrote in an effect, they'd read the previous render's (stale) value, since effects run after the whole tree has rendered.
	loginContextStore.set(ctx);

	useEffect(() => {
		// In React StrictMode (dev) effects run mount -> cleanup -> mount again without a new render in between. The cleanup below resets the store to defaultLoginContext.
		// Without this line the second "mount" would leave the store stuck on that empty default instead of the real ctx.
		loginContextStore.set(ctx);
		loginContextStore.notify();

		return () => {
			loginContextStore.set(defaultLoginContext);
			loginContextStore.notify();
		};
	}, [ctx]);

	return ctx;
}

/**
 * A higher-order component that guards a component with authentication.
 * Waits for the SDK to finish loading, then redirects to the login page if the user is not authenticated.
 *
 * @param {ComponentType<P>} Component - The component to guard.
 * @param {WithAuthGuardOptions} [options] - Optional options for the auth guard.
 * @param {string} [opts.loginUri='/login'] - The URI to redirect to if the user is not authenticated.
 * @returns {ComponentType<P>} The guarded component.
 */
export function withAuthGuard<P extends object>(Component: ComponentType<P>, options?: WithAuthGuardOptions): ComponentType<P> {
	return function AuthGuard(props: P) {
		options ??= {};
		options.loginUri ??= '/login';

		const { loading, isAuthenticated } = useStrivacity();

		useEffect(() => {
			if (!loading && !isAuthenticated) {
				globalThis.location.href = options!.loginUri!;
			}
		}, [loading, isAuthenticated]);

		if (loading || !isAuthenticated) {
			return options.onLoading?.() ?? null;
		}

		return <Component {...props} />;
	};
}
