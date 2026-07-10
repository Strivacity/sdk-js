import { type Handle } from '@sveltejs/kit';
import { getServerSdk } from '$lib/server/strivacity';

export const handle: Handle = async (input) => {
	const serverSdk = getServerSdk();

	return serverSdk.handle(input);
};
