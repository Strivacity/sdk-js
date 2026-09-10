import type { Request as ExpressRequest, Response as ExpressResponse, Router } from 'express';
import type { BaseServerSDK, CookieOptions, LogoutTokenClaims, ServerSDKInitConfig, ServerSDKOptions, SDKStorage } from '@strivacity/sdk-core/types';

export * from '@strivacity/sdk-core/types';

export type AngularServerRequest = ExpressRequest | Request;

export type AngularServerStorage = SDKStorage<
	[req?: AngularServerRequest],
	[req?: ExpressRequest, res?: ExpressResponse, cookieOptions?: CookieOptions],
	[req?: ExpressRequest, res?: ExpressResponse, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type AngularServerSDKOptions<
	Storage extends AngularServerStorage = AngularServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = ServerSDKOptions<Storage, StateStorage>;

export type AngularServerSDKInitConfig<
	Storage extends AngularServerStorage = AngularServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = ServerSDKInitConfig & Partial<AngularServerSDKOptions<Storage, StateStorage>>;

export type AngularServerSDK<TEvent extends AngularServerRequest | undefined = AngularServerRequest | undefined> = BaseServerSDK<TEvent> & {
	/**
	 * The Express router exposing the authentication endpoints.
	 * Mount it under `authUrlPrefix`, e.g. `app.use('/auth', sdk.router)`.
	 */
	readonly handlers: Router;
};
