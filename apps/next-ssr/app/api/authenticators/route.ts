import { NextRequest, NextResponse } from 'next/server';
import { fetchAccountData, introspectToken } from '../../lib/auth/admin';

export const GET = async function listAuthenticators(req: NextRequest) {
	const accessToken: string | undefined = req.headers.get('authorization').split(' ')[1];
	const { sub: accountId } = await introspectToken({ token: accessToken });
	const accountData = await fetchAccountData({ accountId });

	return NextResponse.json(accountData.authenticators.methods, { status: 200 });
};
