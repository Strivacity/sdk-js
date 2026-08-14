import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { ParsedUrlQuery } from 'node:querystring';
import type {
	NextServerSDK,
	NextServerSDKInitConfig,
	WithAuthGuardAppRouterOptions,
	WithAuthGuardPageRouterOptions,
	AppRouterPageRoute,
	AppRouterPageRouteOpts,
	PageRoute,
	AppRouteHandlerFn,
	AppRouteHandlerFnContext,
	PagesRouterRequest,
} from './types';
import { NextResponse, type NextRequest } from 'next/server';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { ConfigurationError } from '@strivacity/sdk-core/utils/errors';
import { createEncryptedCookieStorage } from './storages';
import { apiAppRouteHandlerFactory, apiPageRouteHandlerFactory } from './handlers/api';
import { appRouteHandlerFactory, pageRouteHandlerFactory } from './handlers/route';

/**
 * Creates a Next.js server SDK instance with the provided configuration.
 *
 * @param {NextServerSDKInitConfig} initConfig - The initialization configuration for the SDK.
 * @returns {NextServerSDK} The initialized Next.js server SDK instance.
 */
export function createServerSDK(initConfig: NextServerSDKInitConfig): NextServerSDK {
	if (!initConfig.storage) {
		if (!initConfig.secret) {
			throw new ConfigurationError('Secret is required for encrypted cookie storage');
		}

		initConfig.cookieMaxAge ??= 30 * 24 * 60 * 60;
		initConfig.storage = createEncryptedCookieStorage(initConfig.secret, { defaultCookieOptions: { maxAge: initConfig.cookieMaxAge } });
	}

	const base = createBaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>(
		{
			toRequest: (req) => req as Request,
			redirect: (url, status) => NextResponse.redirect(url, status),
		},
		initConfig,
	);

	function withApiAuthRequired(apiRoute: AppRouteHandlerFn): AppRouteHandlerFn;
	function withApiAuthRequired(apiRoute: NextApiHandler): NextApiHandler;
	function withApiAuthRequired(apiRoute: AppRouteHandlerFn | NextApiHandler): AppRouteHandlerFn | NextApiHandler {
		return (req: NextRequest | Request | NextApiRequest, resOrCtx?: AppRouteHandlerFnContext | NextApiResponse) => {
			if (req instanceof Request) {
				const appRouteHandler = apiAppRouteHandlerFactory(base);
				const wrappedAppRoute = appRouteHandler(apiRoute as AppRouteHandlerFn);
				return wrappedAppRoute(req, (resOrCtx ?? {}) as AppRouteHandlerFnContext);
			}

			const pageRouteHandler = apiPageRouteHandlerFactory(base);
			const wrappedPageRoute = pageRouteHandler(apiRoute as NextApiHandler);
			return wrappedPageRoute(req, resOrCtx as NextApiResponse);
		};
	}

	function withAuthGuard(): PageRoute<Record<string, unknown>, ParsedUrlQuery>;
	function withAuthGuard<P extends Record<string, unknown> = Record<string, unknown>, Q extends ParsedUrlQuery = ParsedUrlQuery>(
		opts: WithAuthGuardPageRouterOptions<P, Q>,
	): PageRoute<P, Q>;
	function withAuthGuard<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(
		fn: AppRouterPageRoute<P>,
		opts?: WithAuthGuardAppRouterOptions<P>,
	): AppRouterPageRoute<P>;
	function withAuthGuard(
		fnOrOpts?: WithAuthGuardPageRouterOptions | AppRouterPageRoute,
		opts?: WithAuthGuardAppRouterOptions,
	): PageRoute<Record<string, unknown>> | AppRouterPageRoute {
		if (typeof fnOrOpts === 'function') {
			const appRouteHandler = appRouteHandlerFactory(base);
			return appRouteHandler(fnOrOpts, opts);
		}

		const pageRouteHandler = pageRouteHandlerFactory(base);
		return pageRouteHandler(fnOrOpts);
	}

	return {
		get options() {
			return base.options;
		},
		withAuthGuard,
		withApiAuthRequired,
		getSession: (req) => base.getSession(req),
		updateSession: (event, session) => base.updateSession(event, session),
		refreshSession: (req) => base.refreshSession(req),
		revokeSession: (req) => base.revokeSession(req),
		getEntrySession: (entryUrl) => base.getEntrySession(entryUrl),
		completeLogin: (params, req) => base.completeLogin(params, req),
		logout: (postLogoutRedirectUri, req) => base.logout(postLogoutRedirectUri, req),
		handleLogin: (req) => base.handleLogin(req),
		handleRegister: (req) => base.handleRegister(req),
		handleCallback: (req) => base.handleCallback(req),
		handleRefresh: (req) => base.handleRefresh(req),
		handleRevoke: (req) => base.handleRevoke(req),
		handleEntry: (req) => base.handleEntry(req),
		handleLogout: (req) => base.handleLogout(req),
		handleBackChannelLogout: (req) => base.handleBackChannelLogout(req),
		handler: async (req) => (await base.handler(req)) ?? new NextResponse('Not Found', { status: 404 }),
	};
}
