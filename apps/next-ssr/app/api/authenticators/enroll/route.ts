import { NextRequest, NextResponse } from 'next/server';
import { consumeEnrollToken, enrollPushMFA, introspectToken } from '../../../lib/auth/admin';

export const POST = async function enroll(req: NextRequest) {
	const token = req.headers.get('authorization')?.split(' ')[1];
	const { deviceToken, target } = (await req.json()) as { deviceToken: string; target: string };
	let accountId: string;

	if (token.startsWith('pm.')) {
		const data = consumeEnrollToken({ token });

		if (!data) {
			return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
		}

		accountId = data.accountId;
	} else {
		accountId = (await introspectToken({ token })).sub;
	}

	const result = await enrollPushMFA({
		target,
		metadata: { deviceToken },
		accountId: accountId,
		identityStore: 'Default',
	});

	return NextResponse.json(result, { status: 201 });
};
