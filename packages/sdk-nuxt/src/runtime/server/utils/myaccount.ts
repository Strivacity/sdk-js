import type { H3Event } from 'h3';
import { defineEventHandler } from 'h3';
import { MyAccountApiError } from '@strivacity/sdk-core/utils/errors';
import { useStrivacity } from '../composables/use-strivacity';

export function defineMyAccountHandler(fn: (event: H3Event, myAccount: ReturnType<typeof useStrivacity>['myAccount']) => Promise<unknown>) {
	return defineEventHandler(async (event) => {
		const sdk = useStrivacity(event);

		if (!(await sdk.getSession())) {
			return Response.json({ error: 'not_authenticated', description: 'The user does not have an active session or is not authenticated' }, { status: 401 });
		}

		try {
			return Response.json(await fn(event, sdk.myAccount));
		} catch (error) {
			if (error instanceof MyAccountApiError) {
				return Response.json({ error: error.message }, { status: error.status });
			}

			throw error;
		}
	});
}
