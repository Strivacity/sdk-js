import type {
	AppRouterPageRoute,
	AppRouterPageRouteOpts,
	NextServerSDK,
	WithAuthGuardAppRouter,
	WithAuthGuardAppRouterOptions,
	WithAuthGuardPageRouter,
} from '../types';

export const appRouteHandlerFactory =
	(
		getSession: NextServerSDK['getSession'],
		config: {
			loginUrl: string;
		},
	): WithAuthGuardAppRouter =>
	<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(handler: AppRouterPageRoute<P>, opts: WithAuthGuardAppRouterOptions<P> = {}) =>
	async (params: P) => {
		const session = await getSession();

		if (!session) {
			const returnTo = typeof opts.returnTo === 'function' ? await opts.returnTo(params) : opts.returnTo;
			const { redirect } = await import('next/navigation');

			redirect(`${config.loginUrl}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
		}

		return handler(params);
	};

export const pageRouteHandlerFactory =
	(
		getSession: NextServerSDK['getSession'],
		config: {
			loginUrl: string;
		},
	): WithAuthGuardPageRouter =>
	({ getServerSideProps, returnTo } = {}) =>
	async (ctx) => {
		const session = await getSession();

		if (!session) {
			return {
				redirect: {
					destination: `${config.loginUrl}?returnTo=${encodeURIComponent(returnTo || ctx.resolvedUrl)}`,
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
