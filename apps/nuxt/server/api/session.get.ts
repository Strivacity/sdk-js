import { appendResponseHeader, defineEventHandler } from 'h3';
import { flushSetCookies } from '@strivacity/sdk-nuxt/utils';

// Demo only: returns the full server-managed session, including the ID and refresh tokens, so the profile page can
// display them. The SDK deliberately keeps these two tokens out of the page payload (`useSession()`); in your own app,
// return only what the UI needs - never the refresh token.
export default defineEventHandler(async (event) => {
	if (!event.context.strivacity) {
		return null;
	}

	const session = await event.context.strivacity.sdk.getSession();
	const cookies = flushSetCookies(event, new Response(null)).headers.getSetCookie();

	// getSession() may refresh the session: a custom storage that queues its `Set-Cookie` headers needs them flushed.
	for (const cookie of cookies) {
		appendResponseHeader(event, 'set-cookie', cookie);
	}

	return session;
});
