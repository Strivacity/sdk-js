import { inject } from 'vue';
import type { PopupContext, RedirectContext, NativeContext } from './types';

const STRIVACITY_SDK = Symbol('sty');

/**
 * Retrieves the Strivacity SDK context for Popup or Redirect flows.
 *
 * @template T The type of context, either PopupContext, RedirectContext or NativeContext.
 *
 * @throws {Error} If the Strivacity SDK context is not found.
 *
 * @returns {T} The Strivacity SDK context, typed as either PopupContext, RedirectContext or NativeContext.
 */
export const useStrivacity = <T extends PopupContext | RedirectContext | NativeContext>() => {
	const context = inject(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing Strivacity SDK context');
	}

	return context as T;
};

export { STRIVACITY_SDK };
