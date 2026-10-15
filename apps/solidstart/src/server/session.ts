import type { SessionData } from '@strivacity/sdk-solid/client';
import { toClientSession } from '@strivacity/sdk-solid/server';
import { sdkOptions } from '../options';
import { getServerSdk } from './strivacity';

export async function getSession(): Promise<SessionData | null> {
	'use server';

	// The session is serialized into the rendered HTML, so long-lived credentials stay out of it: toClientSession drops the refresh and ID tokens.
	return toClientSession(await getServerSdk().getSession());
}

export async function getProfileSession(): Promise<SessionData | null> {
	'use server';

	if (!sdkOptions.serverSessionUri) {
		// Client-managed sessions aren't visible to the server - the profile page reads them from the client SDK.
		return null;
	}

	// Demo only: hands the full session, including the ID and refresh tokens, to the profile page so it can display them.
	// In your own app, return only what the UI needs - never the refresh token.
	return await getServerSdk().getSession();
}
