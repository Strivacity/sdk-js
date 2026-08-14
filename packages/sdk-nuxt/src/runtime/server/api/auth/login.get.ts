import { defineEventHandler, getQuery, setCookie } from 'h3';
import { buildAuthorizationUrl } from '@strivacity/sdk-core/utils/oidc';
import { proxyResponse, RETURN_TO_COOKIE, toSafeRedirect } from '../../utils/helpers';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const { returnTo, ...loginParams } = getQuery<Record<string, string>>(event);
	const safeReturnTo = toSafeRedirect(returnTo, options.redirectUri);
	const url = await buildAuthorizationUrl({
		url: loginParams.loginSessionUri,
		includeOAuthParams: !loginParams.loginSessionUri,
		params: loginParams,
		options: options,
	});

	url.searchParams.append('sdk', 'web');

	const startResponse = await options.httpClient.request<string>(url, {
		method: 'GET',
		credentials: 'include',
		redirect: 'manual',
	});

	options.logging?.debug('Attempting to redirect for login');

	if (safeReturnTo) {
		setCookie(event, RETURN_TO_COOKIE, safeReturnTo, {
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/',
		});
	}

	return proxyResponse(startResponse);
});
