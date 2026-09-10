import type { ExtraRequestArgs, SDK } from './oidc';

export type RedirectOptions = {
	/**
	 * The method used to update the browser's location after authentication or authorization.
	 *
	 * Determines whether the new URL should replace the current URL in the history or be added to it.
	 *
	 * @default 'assign'
	 */
	locationMethod?: 'replace' | 'assign';

	/**
	 * The window in which the redirect should occur.
	 *
	 * Specifies whether the redirect should happen in the top-level window or the current window.
	 *
	 * @default 'self'
	 */
	targetWindow?: 'top' | 'self';
};

export type RedirectParams = ExtraRequestArgs & RedirectOptions;

export type RedirectFlow = SDK<RedirectParams>;
