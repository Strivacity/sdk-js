import type {
	AppRouterPageRoute,
	AppRouterPageRouteOpts,
	NextServerSDK,
	WithAuthGuardAppRouter,
	WithAuthGuardAppRouterOptions,
	WithAuthGuardPageRouter,
} from '../types';

export const appRouteHandlerFactory =
	({ getSession, loginUrl }: { getSession: NextServerSDK['getSession']; loginUrl: string }): WithAuthGuardAppRouter =>
	<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(handler: AppRouterPageRoute<P>, opts: WithAuthGuardAppRouterOptions<P> = {}) =>
	async (params: P) => {
		const session = await getSession();

		if (!session) {
			const returnTo = typeof opts.returnTo === 'function' ? await opts.returnTo(params) : opts.returnTo;
			const { redirect } = await import('next/navigation');

			redirect(`${loginUrl}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
		}

		return handler({ ...params, session });
	};

export const pageRouteHandlerFactory =
	({ getSession, loginUrl }: { getSession: NextServerSDK['getSession']; loginUrl: string }): WithAuthGuardPageRouter =>
	({ getServerSideProps, returnTo } = {}) =>
	async (ctx) => {
		const session = await getSession();

		if (!session) {
			return {
				redirect: {
					destination: `${loginUrl}?returnTo=${encodeURIComponent(returnTo || ctx.resolvedUrl)}`,
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
