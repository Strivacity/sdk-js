import { NextResponse } from 'next/server';
import { sdk } from '../../lib/auth/server';

export const GET = sdk.withApiAuthRequired(async function myApiRoute(req) {
	const res = new NextResponse();
	const session = await sdk.getSession(req);
	return NextResponse.json(session.claims, res);
});
