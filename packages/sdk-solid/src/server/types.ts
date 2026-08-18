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
	Storage,
	StateStorage
>;

export type SolidServerSDKInitConfig<
	Storage extends SolidServerStorage = SolidServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = ServerSDKInitConfig & Partial<SolidServerSDKOptions<Storage, StateStorage>>;

export type SolidServerSDK<TEvent extends RequestEvent | undefined = RequestEvent | undefined> = BaseServerSDK<TEvent> & {
	/**
	 * A `FetchMiddleware` that intercepts and serves the `authUrlPrefix` auth routes (login, register, callback, refresh, revoke, entry, logout, backchannel-logout), calling `next()` for everything else.
	 * Wire it up via `solid({ start: { middleware: './src/middleware.ts' } })` in `vite.config.ts` (default-export it from that module, optionally composed with your own middleware).
	 */
	middleware: FetchMiddleware;
};
