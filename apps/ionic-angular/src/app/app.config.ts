/* eslint-disable @typescript-eslint/no-misused-promises, no-async-promise-executor */
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler, redirectCallbackHandler } from '@strivacity/sdk-core/utils/handlers';
import { provideStrivacity, SDKStorage, SDKHttpClient, LocalStorage, type HttpClientResponse } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

interface ImportMeta {
	env: {
		VITE_MODE: 'redirect' | 'popup' | 'native';
		VITE_ISSUER: string;
		VITE_SCOPES: string;
		VITE_CLIENT_ID: string;
		VITE_REDIRECT_URI: string;
	};
}

class CapacitorHttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const response = await CapacitorHttp.request({
			url,
			method: options?.method || 'GET',
			headers: (options?.headers as Record<string, string>) || {},
			data: options?.body,
			webFetchExtra: options,
		});

		return {
			headers: new Headers(response.headers),
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			statusText: '',
			url: response.url,
			json: () => Promise.resolve(response.data),
			text: () => Promise.resolve(response.data),
		};
	}
}

class CapacitorStorage extends SDKStorage {
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}

	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}

	async delete(key: string): Promise<void> {
		await Preferences.remove({ key });
	}
}

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes),
		provideStrivacity({
			mode: (import.meta as unknown as ImportMeta).env.VITE_MODE,
			issuer: (import.meta as unknown as ImportMeta).env.VITE_ISSUER,
			scopes: (import.meta as unknown as ImportMeta).env.VITE_SCOPES.split(' '),
			clientId: (import.meta as unknown as ImportMeta).env.VITE_CLIENT_ID,
			redirectUri: (import.meta as unknown as ImportMeta).env.VITE_REDIRECT_URI,
			storageTokenName: 'sty.session.angular',
			httpClient: CapacitorHttpClient,
			storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,
			async urlHandler(url, responseMode) {
				if (Capacitor.getPlatform() === 'web') {
					return redirectUrlHandler(url, responseMode);
				} else {
					await InAppBrowser.openInWebView({ url, options: DefaultWebViewOptions });
				}
			},
			async callbackHandler(url, responseMode) {
				if ((import.meta as unknown as ImportMeta).env.VITE_MODE !== 'native' && Capacitor.getPlatform() !== 'web') {
					return new Promise(async (resolve, reject) => {
						let navigationListener: PluginListenerHandle | null = null;
						let finishListener: PluginListenerHandle | null = null;
						let userCancelled = true;

						const cleanupListeners = async () => {
							if (navigationListener) {
								await navigationListener.remove();
								navigationListener = null;
							}

							if (finishListener) {
								await finishListener.remove();
								finishListener = null;
							}
						};

						try {
							navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
								const navigatedUrl = event.url;

								if (navigatedUrl && navigatedUrl.startsWith(url)) {
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
				} else {
					return redirectCallbackHandler(url, responseMode);
				}
			},
		}),
	],
};
