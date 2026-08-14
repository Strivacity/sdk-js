import { defineEventHandler, getRequestURL } from 'h3';
import { useStrivacity } from '../../composables/use-strivacity';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const loginUrl = ['embedded', 'native'].includes(options.mode) ? options.loginUri : `${options.authUrlPrefix}/login`;
	const sdk = useStrivacity(event);
	const url = getRequestURL(event);

	const data = await sdk.getEntrySession(url);
	const uri = new URL(loginUrl, url.origin);
	uri.searchParams.set('session_id', data.session_id!);
	uri.searchParams.set('short_app_id', data.short_app_id!);
	uri.searchParams.set('language', data.language!);

	return Response.redirect(uri, 302);
});
