import { defineEventHandler, getRequestURL } from 'h3';
import { useStrivacity } from '../../composables/use-strivacity';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const sdk = useStrivacity(event);
	const url = getRequestURL(event);

	const logoutUrl = await sdk.logout(new URL(options.postLogoutRedirectUri, url.origin), event);
	return Response.redirect(logoutUrl, 302);
});
