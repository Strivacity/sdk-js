import type { RequestEvent as OriginalRequestEvent, ResponseStub, FetchMiddleware, CookieOptions } from '@solidjs/web';
import type { ServerSDKOptions, ServerSDKInitConfig, SDKStorage, LogoutTokenClaims, BaseServerSDK } from '@strivacity/sdk-core/types';

export * from '@strivacity/sdk-core/types';

export type RequestEvent = OriginalRequestEvent & { response: ResponseStub };

export type SolidServerStorage = SDKStorage<
	[event?: RequestEvent],
	[event?: RequestEvent, cookieOptions?: CookieOptions],
	[event?: RequestEvent, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type SolidServerSDKOptions<Storage extends SolidServerStorage = SolidServerStorage, StateStorage extends SDKStorage = SDKStorage> = ServerSDKOptions<
	RequestEvent | undefined,
	Storage,
	StateStorage
>;

export type SolidServerSDKInitConfig<
	Storage extends SolidServerStorage = SolidServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = ServerSDKInitConfig<RequestEvent | undefined> & Partial<SolidServerSDKOptions<Storage, StateStorage>>;

export type SolidServerSDK<TEvent extends RequestEvent | undefined = RequestEvent | undefined> = BaseServerSDK<TEvent> & {
	/**
	 * A `FetchMiddleware` that intercepts and serves the `authUriPrefix` auth routes (login, register, callback, refresh, revoke, entry, logout, backchannel-logout), calling `next()` for everything else.
	 * Wire it up via `solid({ start: { middleware: './src/middleware.ts' } })` in `vite.config.ts` (default-export it from that module, optionally composed with your own middleware).
	 * The auth routes are served from the ambient request event (`getRequestEvent()`), not from the `request` argument, so place it before any middleware that replaces the request via `next(newRequest)`.
	 */
	middleware: FetchMiddleware;
};
