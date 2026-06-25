import type { ResponseMode } from '../types/oidc';
import type { RedirectParams } from '../types/redirect';

/**
 * Handles URL redirection to a target window using a specified location method.
 *
 * @param {string | URL} url The URL to redirect to.
 * @param {RedirectParams} [params] Optional parameters for the redirection, including the target window and location method.
 * @returns {Promise<void>} A promise that resolves when the redirection occurs.
 */
export async function redirectUrlHandler(url?: string | URL, params?: RedirectParams): Promise<void> {
	const targetWindow = params?.targetWindow === 'top' ? globalThis.window?.top : globalThis.window?.self;
	const method = params?.locationMethod ?? 'assign';

	if (!url) {
		return Promise.reject(new Error('No URL provided for redirection'));
	}

	if (targetWindow) {
		targetWindow.location[method](url);
	}

	// NOTE: Wait for the previous action to complete before resolving the promise
	return Promise.resolve();
}

/**
 * Handles the callback after a redirect and parses the response from the URL.
 *
 * @param {string | URL} [url=globalThis.window?.location.href] The URL to parse, defaults to the current window location.
 * @param {ResponseMode} responseMode The response mode, either 'query' or 'fragment'.
 * @returns {Promise<Record<string, string>>} A promise that resolves to the parsed response data.
 */
export function redirectCallbackHandler(
	url: string | URL | undefined = globalThis.window?.location.href,
	responseMode?: ResponseMode,
): Promise<Record<string, string>> {
	if (!url) {
		return Promise.reject(new Error('No URL provided for redirect callback handling'));
	}

	const raw = new URL(url)[responseMode === 'fragment' ? 'hash' : 'search'].slice(1);

	return Promise.resolve(Object.fromEntries(new URLSearchParams(raw)));
}
