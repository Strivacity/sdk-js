import type { NextRequest } from 'next/server';
import type {
	AppRouterPageRoute,
	AppRouterPageRouteOpts,
	BaseServerSDK,
	PagesRouterRequest,
	WithAuthGuardAppRouter,
	WithAuthGuardAppRouterOptions,
	WithAuthGuardPageRouter,
} from '../types';
import { isSessionExpired } from '@strivacity/sdk-core/utils';

/**
 * Builds the Server SDK refresh route URL for an expired session. Guards cannot refresh in place: server components cannot set
 * cookies, so the rotated session would be lost. The refresh route writes the cookie and then redirects back to `returnTo`.
 *
 * @param {BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>} sdk - The server SDK.
 * @param {string} returnTo - Where to return after the refresh.
 * @returns {string} The refresh route URL.
 */
function refreshUrl(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>, returnTo: string): string {
	return `${sdk.options.authUriPrefix}/refresh?returnTo=${encodeURIComponent(returnTo)}`;
}

export const appRouteHandlerFactory =
	(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>): WithAuthGuardAppRouter =>
	<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(handler: AppRouterPageRoute<P>, opts: WithAuthGuardAppRouterOptions<P> = {}) =>
	async (params: P) => {
		// NOTE: Server Components cannot set cookies, so never refresh here: an expired session goes through the refresh route
		let session = await sdk.getSession(undefined, { autoRefresh: false });

		if (session && isSessionExpired(session, sdk.options.refreshSkew)) {
			if (session.refresh_token && sdk.options.autoRefresh !== false) {
				const returnTo = typeof opts.returnTo === 'function' ? await opts.returnTo(params) : opts.returnTo;
				const { redirect } = await import('next/navigation');

				redirect(refreshUrl(sdk, returnTo || sdk.options.postLoginRedirectUri));
			}

			session = null;
		}

		if (!session) {
			const returnTo = typeof opts.returnTo === 'function' ? await opts.returnTo(params) : opts.returnTo;
			const { redirect } = await import('next/navigation');

			redirect(`${sdk.options.loginPageUri}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
		}

		return handler({ ...params, session });
	};

export const pageRouteHandlerFactory =
	(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>): WithAuthGuardPageRouter =>
	({ getServerSideProps, returnTo } = {}) =>
	async (ctx) => {
		// NOTE: Server Components cannot set cookies, so never refresh here: an expired session goes through the refresh route
		const session = await sdk.getSession(ctx.req, { autoRefresh: false });

		if (session && isSessionExpired(session, sdk.options.refreshSkew)) {
			return {
				redirect: {
					destination:
						session.refresh_token && sdk.options.autoRefresh !== false
							? refreshUrl(sdk, returnTo || ctx.resolvedUrl)
							: `${sdk.options.loginPageUri}?returnTo=${encodeURIComponent(returnTo || ctx.resolvedUrl)}`,
					permanent: false,
				},
			};
		}

		if (!session) {
			return {
				redirect: {
					destination: `${sdk.options.loginPageUri}?returnTo=${encodeURIComponent(returnTo || ctx.resolvedUrl)}`,
					permanent: false,
				},
			};
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let ret: any = { props: {} };

		if (getServerSideProps) {
			ret = await getServerSideProps(ctx);
		}

		if (ret.props instanceof Promise) {
			const props = await ret.props;

			return {
				...ret,
				props: {
					session,
					...props,
				},
			};
		}

		return { ...ret, props: { session, ...ret.props } };
	};
