import type { Handle, RequestEvent } from '@sveltejs/kit';
import type {
	ServerSDKOptions,
	ServerSDKInitConfig,
	SDKStorage,
	SessionData,
	CookieOptions,
	LogoutTokenClaims,
	BaseServerSDK,
} from '@strivacity/sdk-core/types';

export * from '@strivacity/sdk-core/types';

export type SvelteKitServerStorage = SDKStorage<
	[event?: RequestEvent],
	[event?: RequestEvent, cookieOptions?: CookieOptions],
	[event?: RequestEvent, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type SvelteKitServerSDKOptions<
	Storage extends SvelteKitServerStorage = SvelteKitServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = ServerSDKOptions<RequestEvent, Storage, StateStorage>;

export type SvelteKitServerSDKInitConfig<
	Storage extends SvelteKitServerStorage = SvelteKitServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = ServerSDKInitConfig<RequestEvent> & Partial<SvelteKitServerSDKOptions<Storage, StateStorage>>;

export type SvelteKitServerSDK = BaseServerSDK<RequestEvent> & {
	/**
	 * A SvelteKit `Handle` hook that intercepts and serves the `authUrlPrefix` auth routes.
	 * Mount it in `src/hooks.server.ts`, optionally combined with your own hooks via `sequence()`.
	 */
	handle: Handle;

	/**
	 * Guard for `+page.server.ts`/`+layout.server.ts` `load()` functions: returns the current session, or throws a SvelteKit `redirect()` to the login page if unauthenticated.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @param {Object} [options] - Optional options for the session requirement.
	 * @param {string} [options.returnTo] - Optional relative path to redirect to after login. Defaults to the current page.
	 * @returns {Promise<SessionData>} A promise that resolves to the current session data if authenticated.
	 * @throws {Redirect} Throws a SvelteKit `redirect()` to the login page if unauthenticated.
	 */
	requireSession(event: RequestEvent, options?: { returnTo?: string }): Promise<SessionData>;
};
