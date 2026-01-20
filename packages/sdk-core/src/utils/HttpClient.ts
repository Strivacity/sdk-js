import { SDKHttpClient, type HttpClientResponse } from '../types';

export class HttpClient extends SDKHttpClient {
	async request<T>(url: string | URL, options?: RequestInit): Promise<HttpClientResponse<T>> {
		url = new URL(url);

		this.logging?.debug(`REQUEST [${options?.method || 'GET'}]: ${url.origin}${url.pathname}`);

		const response = await fetch(url, options);

		if (this.logging && response.headers.has('x-event-id')) {
			const xEventId = response.headers.get('x-event-id') as string;

			if (this.logging.xEventId !== xEventId) {
				this.logging.xEventId = xEventId;
				this.logging.debug(`X-Event-ID updated: ${this.logging.xEventId}`);
			}
		}

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
