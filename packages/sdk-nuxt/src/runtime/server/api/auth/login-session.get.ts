import { defineEventHandler, getQuery } from 'h3';
import { buildAuthorizationUrl } from '@strivacity/sdk-core/utils/oidc';
import { proxyResponse } from '../../utils/helpers';

export default defineEventHandler(async (event) => {
	const options = event.context.strivacity.options;
	const loginParams = getQuery<Record<string, string>>(event);
	const url = await buildAuthorizationUrl({
		url: loginParams.loginSessionUri,
		includeOAuthParams: !loginParams.loginSessionUri,
		params: loginParams,
		options: options,
	});

	url.searchParams.append('sdk', 'web-embedded');

	const startResponse = await options.httpClient.request<string>(url, {
		method: 'GET',
		credentials: 'include',
		redirect: 'manual',
	});

	return proxyResponse(startResponse);
});
