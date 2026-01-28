import { getContext } from 'svelte';
import type { PopupContext, RedirectContext, NativeContext } from './types';

export const STRIVACITY_SDK = Symbol('sty');

/**
 * Hook to access the Strivacity SDK context
 *
 * @template T Extends either PopupContext, RedirectContext or NativeContext.
 *
 * @returns {T} The current Strivacity SDK context.
 *
 * @throws {Error} If the context is not provided by an AuthProvider.
 */
export const useStrivacity = <T extends PopupContext | RedirectContext | NativeContext>() => {
	const context = getContext<T>(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing Strivacity SDK context');
	}

	return context;
};
