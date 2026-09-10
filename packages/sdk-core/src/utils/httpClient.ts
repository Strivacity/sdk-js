import type { SDKLogging, HttpClientResponse, SDKHttpClient } from '../types/common';
import { NetworkError } from './errors';

export function createHttpClient(logging?: SDKLogging): SDKHttpClient {
	const client: SDKHttpClient = {
		logger: logging,
		async request<T>(url: string | URL, options?: RequestInit): Promise<HttpClientResponse<T>> {
			url = new URL(url, globalThis.location?.origin);

			client.logger?.debug(`REQUEST [${options?.method || 'GET'}]: ${url.origin}${url.pathname}`);

			let response: Response;

			try {
				response = await fetch(url, options);
			} catch {
				throw new NetworkError(`Network request failed: ${url.origin}${url.pathname}`);
			}

			if (client.logger && response.headers.has('x-event-id')) {
				const xEventId = response.headers.get('x-event-id') as string;

				if (client.logger.xEventId !== xEventId) {
					client.logger.xEventId = xEventId;
					client.logger.debug(`X-Event-ID updated: ${client.logger.xEventId}`);
				}
			}

			return {
				headers: response.headers,
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				url: response.url,
				body: response.body,
				json: async () => (await response.json()) as T,
				text: async () => await response.text(),
				// NOTE: Only json and text methods are supported in native platforms.
			};
		},
		sendTokenRequest<T>(url: string | URL, data: Record<string, string>): Promise<HttpClientResponse<T>> {
			return client.request<T>(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams(data).toString(),
			});
		},
	};

	return client;
}
