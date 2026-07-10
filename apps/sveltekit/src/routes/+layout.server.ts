import type { LayoutServerLoad } from './$types';
import { getServerSdk } from '$lib/server/strivacity';

export const load: LayoutServerLoad = async (event) => {
	const sdk = getServerSdk();

	return {
		session: await sdk.getSession(event),
	};
};
