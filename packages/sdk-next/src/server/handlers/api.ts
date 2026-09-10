import type { BaseServerSDK, PagesRouterRequest, WithApiAuthRequiredAppRoute, WithApiAuthRequiredPageRoute } from '../types';
import { NextRequest, NextResponse } from 'next/server';
import { toNextRequest } from '../utils';

export const apiAppRouteHandlerFactory =
	(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>): WithApiAuthRequiredAppRoute =>
	(apiRoute) =>
	async (req: NextRequest | Request, params): Promise<NextResponse> => {
		const nextReq = req instanceof Request ? toNextRequest(req) : req;

		const session = await sdk.getSession(nextReq);

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
	(sdk: BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>): WithApiAuthRequiredPageRoute =>
	(apiRoute) =>
	async (req, res) => {
		const session = await sdk.getSession(req);

		if (!session) {
			return res.status(401).json({
				error: 'not_authenticated',
				description: 'The user does not have an active session or is not authenticated',
			});
		}

		await apiRoute(req, res);
	};
