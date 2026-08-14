import { inject, type InjectionKey } from 'vue';
import type { LoginContext } from '../types';

export const STRIVACITY_LOGIN_CONTEXT: InjectionKey<LoginContext> = Symbol('strivacity-login-context');

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
