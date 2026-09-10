import type { PageServerLoad } from './$types';
import { sdkOptions } from '$lib/options';
import { getServerSdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	if (!sdkOptions.serverSessionUri) {
		// Client-managed sessions aren't visible to server `load` functions - the guard component-side (ctx.isAuthenticated) is what protects this mode.
		return;
	}

	await getServerSdk().requireSession(event, { returnTo: '/profile' });
};
