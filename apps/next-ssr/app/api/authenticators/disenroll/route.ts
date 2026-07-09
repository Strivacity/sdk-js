import { NextRequest, NextResponse } from 'next/server';
import { sdk } from '../../../lib/auth/server';
import { disenrollPushMFA, fetchAccountData, introspectToken } from '../../../lib/auth/admin';

export const DELETE = async function disenrollAll(req: NextRequest) {
	const token = req.headers.has('authorization') ? req.headers.get('authorization')?.split(' ')[1] : (await sdk.getSession(req)).access_token;
	const { sub: accountId } = await introspectToken({ token });
	const accountData = await fetchAccountData({ accountId });

	for (const authenticator of accountData.authenticators?.methods || []) {
		if (authenticator.type === 'custom') {
			await disenrollPushMFA({ accountId, authenticatorId: authenticator.id });
		}
	}

	return new NextResponse(null, { status: 204 });
};
