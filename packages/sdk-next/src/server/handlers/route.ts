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

export const appRouteHandlerFactory =
	(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>): WithAuthGuardAppRouter =>
	<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(handler: AppRouterPageRoute<P>, opts: WithAuthGuardAppRouterOptions<P> = {}) =>
	async (params: P) => {
		const session = await sdk.getSession();

		if (!session) {
			const returnTo = typeof opts.returnTo === 'function' ? await opts.returnTo(params) : opts.returnTo;
			const { redirect } = await import('next/navigation');

			redirect(`${sdk.options.loginUri}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
		}

		return handler({ ...params, session });
	};

export const pageRouteHandlerFactory =
	(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>): WithAuthGuardPageRouter =>
	({ getServerSideProps, returnTo } = {}) =>
	async (ctx) => {
		const session = await sdk.getSession();

		if (!session) {
			return {
				redirect: {
					destination: `${sdk.options.loginUri}?returnTo=${encodeURIComponent(returnTo || ctx.resolvedUrl)}`,
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
