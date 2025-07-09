/* eslint-disable @typescript-eslint/no-misused-promises, no-async-promise-executor */
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler, redirectCallbackHandler } from '@strivacity/sdk-core/utils/handlers';
import { type SDKOptions, StyAuthProvider, useStrivacity, SDKStorage, SDKHttpClient, LocalStorage, type HttpClientResponse } from '@strivacity/sdk-react';
import { App } from './components/App';
import { Callback } from './pages/Callback';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Logout } from './pages/Logout';
import { Profile } from './pages/Profile';
import { Register } from './pages/Register';
import { Revoke } from './pages/Revoke';

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

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.react',
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
		if (import.meta.env.VITE_MODE !== 'native' && Capacitor.getPlatform() !== 'web') {
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
};

const RouteGuard = ({ children }: { children: React.ReactElement }) => {
	const { loading, isAuthenticated } = useStrivacity();

	if (loading) {
		return <h1>Loading...</h1>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return children;
};

createRoot(document.getElementById('app')!).render(
	<BrowserRouter>
		<StyAuthProvider options={options}>
			<Routes>
				<Route element={<App />}>
					<Route index element={<Home />} />
					<Route path="/callback" element={<Callback />} />
					<Route path="/login" element={<Login />} />
					<Route path="/logout" element={<Logout />} />
					<Route
						path="/profile"
						element={
							<RouteGuard>
								<Profile />
							</RouteGuard>
						}
					/>
					<Route path="/register" element={<Register />} />
					<Route path="/revoke" element={<Revoke />} />
				</Route>
			</Routes>
		</StyAuthProvider>
	</BrowserRouter>,
);
