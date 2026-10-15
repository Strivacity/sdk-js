import type { LayoutServerLoad } from './$types';
import { toClientSession } from '@strivacity/sdk-svelte/server';
import { getServerSdk } from '$lib/server/strivacity';

export const load: LayoutServerLoad = async (event) => {
	const sdk = getServerSdk();

	// getSession refreshes a near-expiry session once per request (handle writes the rotated cookie). Layout data is serialized
	// into every page, so long-lived credentials stay out of it: toClientSession drops the refresh and ID tokens.
	return {
		session: toClientSession(await sdk.getSession(event)),
	};
};
