import { deleteCookie, getCookie, defineEventHandler, getQuery } from 'h3';
import { parseState } from '@strivacity/sdk-core/utils/state';
import { RETURN_TO_COOKIE } from '../../utils/helpers';
import { useStrivacity } from '../../composables/use-strivacity';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const sdk = useStrivacity(event);
	const params = getQuery<Record<string, string>>(event);

	const serializedState = await options.stateStorage.get(`sty.${params.state}`);

	await sdk.completeLogin(params, event);

	if (!serializedState) {
		throw new Error('State not found or expired. Please try logging in again.');
	}

	const state = parseState(serializedState);
	const returnTo = getCookie(event, RETURN_TO_COOKIE) ?? options.postLoginRedirectUri;
	deleteCookie(event, RETURN_TO_COOKIE);

	if (state.metadata?.display === 'popup') {
		// NOTE: If the login was initiated from a popup, we return a HTML page that will close the popup and notify the opener window.
		return new Response(`<!DOCTYPE html><html><body><script>window.opener?.postMessage({}, '*');window.close();</script></body></html>`, {
			headers: { 'content-type': 'text/html; charset=utf-8' },
		});
	}

	return Response.redirect(new URL(returnTo, options.redirectUri), 302);
});
