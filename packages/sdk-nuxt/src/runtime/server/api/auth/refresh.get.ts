import { defineEventHandler, getQuery, getRequestURL } from 'h3';
import { toSafeRedirect } from '../../utils/helpers';
import { useStrivacity } from '../../composables/use-strivacity';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const sdk = useStrivacity(event);
	const url = getRequestURL(event);
	const { returnTo } = getQuery<Record<string, string>>(event);
	const safeReturnTo = toSafeRedirect(returnTo, options.redirectUri);

	try {
		await sdk.refreshSession(event);

		if (safeReturnTo) {
			return Response.redirect(new URL(safeReturnTo, url.origin).toString(), 302);
		}

		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof Error && error.message === 'No refresh token available') {
			const uri = new URL(options.postLoginRedirectUri, url.origin);

			if (safeReturnTo) {
				uri.searchParams.set('returnTo', safeReturnTo);
			}

			return Response.redirect(uri.toString(), 302);
		}

		throw error;
	}
});
