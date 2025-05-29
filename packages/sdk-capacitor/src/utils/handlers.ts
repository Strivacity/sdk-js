import type { ResponseMode } from '@strivacity/sdk-core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { WebViewOptions } from '@capacitor/inappbrowser';
import type { CapacitorParams } from '../types';
import { Capacitor } from '@capacitor/core';
import { InAppBrowser } from '@capacitor/inappbrowser';

/**
 * Handles URL redirection to a target window using a specified location method.
 *
 * @param {URL} url The URL to redirect to.
 * @param {OpenOptions} [params] Optional parameters for the redirection, including the target window and location method.
 * @returns {Promise<void>} A promise that resolves when the redirection occurs.
 */
export async function urlHandler(url: URL, params?: CapacitorParams): Promise<void> {
	if (Capacitor.getPlatform() === 'web') {
		window.self.location.assign(url);

		// NOTE: Wait for the previous action
		return new Promise(() => undefined);
	} else {
		await InAppBrowser.openInWebView({ url: url.toString(), options: params as WebViewOptions });
	}
}

/**
 * Handles the callback after a redirect and parses the response from the URL.
 *
 * @param {string} expectedRedirectUri The expected redirect URI (the app's custom URL scheme) that signals the end of the authentication flow.
 * @param {ResponseMode} responseMode The response mode, either 'query' or 'fragment'.
 * @returns {Record<string, string>} A key-value map of the parsed URL parameters.
 */
export async function callbackHandler(expectedRedirectUri: string, responseMode: ResponseMode): Promise<Record<string, string>> {
	return new Promise(async (resolve, reject) => {
		let navigationListener: PluginListenerHandle | null = null;
		let finishListener: PluginListenerHandle | null = null;
		let userCancelled = true;

		const cleanupListeners = async () => {
			if (navigationListener) {
				try {
					await navigationListener.remove();
				} catch (e) {
					console.warn('Failed to remove navigation listener', e);
				}
				navigationListener = null;
			}
			if (finishListener) {
				try {
					await finishListener.remove();
				} catch (e) {
					console.warn('Failed to remove finish listener', e);
				}
				finishListener = null;
			}
		};

		try {
			navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
				const navigatedUrl = event.url;

				if (navigatedUrl && navigatedUrl.startsWith(expectedRedirectUri)) {
					try {
						const urlInstance = new URL(navigatedUrl);
						const dataString = responseMode === 'query' ? urlInstance.search : urlInstance.hash;
						const params = Object.fromEntries(new URLSearchParams(dataString.slice(1)));

						userCancelled = false;
						await InAppBrowser.close();
						resolve(params);
					} catch (error) {
						await InAppBrowser.close();
						reject(error);
					}
				}
			});

			finishListener = await InAppBrowser.addListener('browserClosed', async () => {
				await cleanupListeners();

				if (userCancelled) {
					reject(new Error('InAppBrowser flow cancelled by user.'));
				}
			});
		} catch (error) {
			reject(error);
		}
	});
}
