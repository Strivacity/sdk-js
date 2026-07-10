import { type Handle } from '@sveltejs/kit';
import { sdkOptions } from '$lib/options';
import { getServerSdk } from '$lib/server/strivacity';

export const handle: Handle = async (input) => {
	const { event } = input;
	const serverSdk = getServerSdk();

	if (sdkOptions.serverSideSession) {
		if (event.url.pathname === '/profile') {
			await serverSdk.requireSession(event, { returnTo: '/profile' });
		}
	}

	return serverSdk.handle(input);
};
