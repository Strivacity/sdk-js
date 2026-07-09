import { NextRequest, NextResponse } from 'next/server';
import { sdk } from '../../../lib/auth/server';
import { generateEnrollToken, introspectToken } from '../../../lib/auth/admin';

export const GET = sdk.withApiAuthRequired(async function createEnrollToken(req: NextRequest) {
	const session = await sdk.getSession(req);

	const { sub: accountId } = await introspectToken({ token: session.access_token! });
	const { token, expiresAt } = generateEnrollToken({ accountId: accountId! });

	return NextResponse.json({ token, expiresAt }, { status: 201 });
});
