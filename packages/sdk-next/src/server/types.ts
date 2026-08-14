/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult, NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest, NextResponse } from 'next/server';
import type { ServerSDKOptions, ServerSDKInitConfig, SDKStorage, SessionData, CookieOptions, LogoutTokenClaims, BaseServerSDK } from './types';

export * from '@strivacity/sdk-core/types';

export type PagesRouterRequest = IncomingMessage | NextApiRequest;
export type PagesRouterResponse = ServerResponse<IncomingMessage> | NextApiResponse;

export type AppRouteHandlerFnContext = {
	/**
	 * The parameters passed to the API route handler.
	 */
	params?: Promise<Record<string, string | string[]>>;
};

export type AppRouteHandlerFn = (req: NextRequest | Request, ctx: AppRouteHandlerFnContext) => Promise<Response> | Response;

export type WithApiAuthRequiredAppRoute = (apiRoute: AppRouteHandlerFn) => AppRouteHandlerFn;

export type WithApiAuthRequiredPageRoute = (apiRoute: NextApiHandler) => NextApiHandler;

export type WithApiAuthRequired = WithApiAuthRequiredAppRoute & WithApiAuthRequiredPageRoute;

export type GetServerSidePropsResultWithSession<P = any> = GetServerSidePropsResult<P & { session: SessionData }>;

export type PageRoute<P, Q extends ParsedUrlQuery = ParsedUrlQuery> = (ctx: GetServerSidePropsContext<Q>) => Promise<GetServerSidePropsResultWithSession<P>>;

export type AppRouterPageRouteOpts = {
	/**
	 * The parameters passed to the page route.
	 */
	params?: Promise<Record<string, string | string[]>>;

	/**
	 * The search parameters passed to the page route.
	 */
	searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;

	/**
	 * The session data for the authenticated user, if available.
	 */
	session?: SessionData;
};

export type AppRouterPageRoute<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts> = (obj: P) => Promise<any> | any;

export type WithAuthGuardPageRouterOptions<P extends { [key: string]: any } = { [key: string]: any }, Q extends ParsedUrlQuery = ParsedUrlQuery> = {
	/**
	 * Returns the result of the `getServerSideProps` function, which is used to fetch data for a page before rendering it.
	 * This function is executed on the server side and allows you to pass props to the page component.
	 *
	 * @param {GetServerSidePropsContext<Q>} ctx - The context object containing information about the request and response.
	 * @returns {Promise<GetServerSidePropsResultWithSession<P>>} The result of the `getServerSideProps` function, which includes the props to be passed to the page component.
	 */
	getServerSideProps?: GetServerSideProps<P, Q>;

	/**
	 * The URL to redirect the user to after a successful login.
	 */
	returnTo?: string;
};

export type WithAuthGuardPageRouter = <P extends { [key: string]: any } = { [key: string]: any }, Q extends ParsedUrlQuery = ParsedUrlQuery>(
	opts?: WithAuthGuardPageRouterOptions<P, Q>,
) => PageRoute<P, Q>;

export type WithAuthGuardAppRouterOptions<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts> = {
	/**
	 * The URL to redirect the user to after a successful login.
	 */
	returnTo?: string | ((obj: P) => Promise<string> | string);
};

export type WithAuthGuardAppRouter = <P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(
	fn: AppRouterPageRoute<P>,
	opts?: WithAuthGuardAppRouterOptions<P>,
) => AppRouterPageRoute<P>;

export type WithAuthGuard = WithAuthGuardPageRouter & WithAuthGuardAppRouter;

export type NextServerStorage = SDKStorage<
	[req?: NextRequest | Request | PagesRouterRequest],
	[req?: NextRequest | Request | PagesRouterRequest, res?: NextResponse | PagesRouterResponse, cookieOptions?: CookieOptions],
	[req?: NextRequest | Request | PagesRouterRequest, res?: NextResponse | PagesRouterResponse, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type NextServerSDKOptions<Storage extends NextServerStorage = NextServerStorage, StateStorage extends SDKStorage = SDKStorage> = ServerSDKOptions<
	Storage,
	StateStorage
>;

export type NextServerSDKInitConfig<Storage extends NextServerStorage = NextServerStorage, StateStorage extends SDKStorage = SDKStorage> = ServerSDKInitConfig &
	Partial<NextServerSDKOptions<Storage, StateStorage>>;

export type NextServerSDK<TEvent extends NextRequest | Request | PagesRouterRequest | undefined = NextRequest | Request | PagesRouterRequest | undefined> =
	BaseServerSDK<TEvent> & {
		/**
		 * Wraps a React component with an authentication guard. If the user is not authenticated, they will be redirected to the login page.
		 *
		 * @param {React.ComponentType<any>} Component - The React component to wrap with the authentication guard.
		 * @returns {React.ComponentType<any>} A new React component that includes the authentication guard.
		 */
		withAuthGuard: WithAuthGuard;

		/**
		 * Wraps an API route handler with an authentication guard. Returns 401 if the user is not authenticated.
		 *
		 * @param {AppRouteHandlerFn | NextApiHandler} apiRoute - The API route handler to wrap.
		 * @returns The wrapped handler that enforces authentication.
		 */
		withApiAuthRequired: WithApiAuthRequired;
	};
