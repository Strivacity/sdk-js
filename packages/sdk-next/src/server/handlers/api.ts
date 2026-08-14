import type { NextServerSDK, WithApiAuthRequiredAppRoute, WithApiAuthRequiredPageRoute } from '../types';
import { NextRequest, NextResponse } from 'next/server';
import { toNextRequest } from '../utils';

export const apiAppRouteHandlerFactory =
	(getSession: NextServerSDK['getSession']): WithApiAuthRequiredAppRoute =>
	(apiRoute) =>
	async (req: NextRequest | Request, params): Promise<NextResponse> => {
		const nextReq = req instanceof Request ? toNextRequest(req) : req;

		const session = await getSession();

		if (!session) {
			return NextResponse.json(
				{
					error: 'not_authenticated',
					description: 'The user does not have an active session or is not authenticated',
				},
				{ status: 401 },
			);
		}

		const apiRes: NextResponse | Response = await apiRoute(nextReq, params);
		const nextApiRes: NextResponse = apiRes instanceof NextResponse ? apiRes : new NextResponse(apiRes.body, apiRes);

		return nextApiRes;
	};

export const apiPageRouteHandlerFactory =
	(getSession: NextServerSDK['getSession']): WithApiAuthRequiredPageRoute =>
	(apiRoute) =>
	async (req, res) => {
		const session = await getSession();

		if (!session) {
			return res.status(401).json({
				error: 'not_authenticated',
				description: 'The user does not have an active session or is not authenticated',
			});
		}

		await apiRoute(req, res);
	};
