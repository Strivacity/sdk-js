import { defineEventHandler, getRequestURL } from 'h3';
import { useStrivacity } from '../../composables/use-strivacity';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const sdk = useStrivacity(event);
	const url = getRequestURL(event);
	const redirectUrl = new URL(options.postLogoutRedirectUri, url.origin);

	await sdk.revokeSession(event);

	return Response.redirect(redirectUrl, 302);
});
