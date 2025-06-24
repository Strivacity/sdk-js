import { SDKHttpClient, type HttpClientResponse } from '../types';

export class HttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const response = await fetch(url, options);

		return {
			headers: response.headers,
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
			url: response.url,
			json: async () => (await response.json()) as T,
			text: async () => await response.text(),
			// NOTE: Only json and text methods are supported in native platforms.
		};
	}
}
