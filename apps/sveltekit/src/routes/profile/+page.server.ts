import type { PageServerLoad } from './$types';
import { sdkOptions } from '$lib/options';
import { getServerSdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	if (!sdkOptions.serverSessionUri) {
		// Client-managed sessions aren't visible to server `load` functions - the guard component-side (ctx.isAuthenticated) is what protects this mode.
		return { session: null };
	}

	const session = await getServerSdk().requireSession(event, { returnTo: '/profile' });

	// Demo only: hands the full session, including the ID and refresh tokens, to this page so it can display them.
	// In your own app, return only what the UI needs - never the refresh token.
	return { session };
};
