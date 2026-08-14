import type { RemixServerSDK, WithApiAuthRequired, WithAuthGuard, ServerWithAuthGuardOptions } from '../types';
import { redirect } from '@remix-run/node';

export const withApiAuthRequiredFactory =
	(getSession: RemixServerSDK['getSession']): WithApiAuthRequired =>
	(handler) =>
	async (req) => {
		const session = await getSession(req);

		if (!session) {
			return Response.json(
				{
					error: 'not_authenticated',
					description: 'The user does not have an active session or is not authenticated',
				},
				{ status: 401 },
			);
		}

		return handler(req);
	};

export const withAuthGuardFactory =
	(getSession: RemixServerSDK['getSession'], loginUrl: string): WithAuthGuard =>
	(handler, opts: ServerWithAuthGuardOptions = {}) =>
	async (req) => {
		const session = await getSession(req);

		if (!session) {
			const returnTo = typeof opts.returnTo === 'function' ? await opts.returnTo(req) : opts.returnTo;
			const url = new URL(req.url);
			const safeReturnTo = returnTo ?? url.pathname + url.search;

			return redirect(`${loginUrl}${safeReturnTo ? `?returnTo=${encodeURIComponent(safeReturnTo)}` : ''}`);
		}

		return handler({ req, session });
	};
