import type { ComponentType } from 'preact';
import type { RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, LoginContext, SDKContext, UseNativeLoginOptions, WithAuthGuardOptions } from './types';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'preact/compat';
import { createNativeLoginController } from '@strivacity/sdk-core/utils';
import { appendReturnTo } from '@strivacity/sdk-core/utils/path';

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
		throw new Error('Missing SDK context');
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
	const controller = useMemo(() => createNativeLoginController(() => sdk, options), [sdk]);

	// NOTE: We need to set the options on every render, because the options object may change between renders.
	controller.setOptions(options);

	const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

	useEffect(() => {
		if (sdk) {
			void controller.start();
		}
	}, [sdk, controller]);

	const ctx = useMemo(
		() => ({
			...snapshot,
			triggerFallback: controller.triggerFallback,
			triggerClose: controller.triggerClose,
			submitForm: controller.submitForm,
			setFormValue: controller.setFormValue,
			setMessage: controller.setMessage,
		}),
		[snapshot, controller],
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
 * @param {ComponentType<P>} WrappedComponent - The component to guard.
 * @param {WithAuthGuardOptions} [options] - Optional options for the auth guard.
 * @param {string} [opts.loginUri='/login'] - The URI to redirect to if the user is not authenticated.
 * @returns {ComponentType<P>} The guarded component.
 */
export function withAuthGuard<P extends object>(WrappedComponent: ComponentType<P>, options?: WithAuthGuardOptions): ComponentType<P> {
	return function AuthGuard(props: P) {
		const { loading, sdk } = useStrivacity();
		const [authenticated, setAuthenticated] = useState<boolean | null>(null);

		useEffect(() => {
			if (loading) {
				return;
			}

			let disposed = false;

			void sdk.checkAuthentication().then((result) => {
				if (disposed) {
					return;
				}

				setAuthenticated(result);

				if (!result) {
					if (sdk.options.serverSessionUri && sdk.session) {
						return sdk.refresh();
					}

					globalThis.location.href = appendReturnTo(options?.loginUri ?? '/login');
				}
			});

			return () => {
				disposed = true;
			};
		}, [loading, sdk]);

		if (loading || !authenticated) {
			return options?.onLoading?.() ?? null;
		}

		return <WrappedComponent {...props} />;
	};
}
