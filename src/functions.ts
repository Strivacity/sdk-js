/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEFAULT_TIMEOUT } from './constants';

export const request = async <Response = any, Data = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD', url: RequestInfo, body?: Data, options: RequestInit = {}, timeout: number = DEFAULT_TIMEOUT): Promise<Response> => {
	const controller = new AbortController();
	const signal = controller.signal;

	let timeoutId!: number;

	options.signal = signal;

	return Promise.race([
		requestWithOutTimeout(method, url, body, options),
		new Promise((_, reject) => {
			timeoutId = window.setTimeout(() => {
				controller.abort();
				reject(new Error(`Timeout (${timeout}ms) when executing 'fetch'`));
			}, timeout);
		}),
	]).finally(() => {
		clearTimeout(timeoutId);
	});
};

export const requestWithOutTimeout = async <Response = any, Data = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD', url: RequestInfo, body?: Data, options: RequestInit = {}): Promise<Response> => {
	const init: any = {
		...options,
		method: method,
	};

	if (!init.headers) {
		init.headers = {};
	}

	init.headers['Content-Type'] = 'application/json';

	if (body) {
		init.body = JSON.stringify(body);
	}

	try {
		const fetchResult = await fetch(url, init);

		if (!fetchResult.ok) {
			let error = undefined;

			try {
				error = await fetchResult.json();

			} catch {
			}

			throw { message: fetchResult.statusText, code: fetchResult.status, error: error };
		}

		const clonedResult = fetchResult.clone();

		try {
			const textResponse = await clonedResult.text();

			if (!textResponse.length) {
				return Promise.resolve('' as any) as Promise<Response>;
			}

			return await fetchResult.json();
		} catch (error) {
			return Promise.reject(error);
		}
	} catch (error) {
		return Promise.reject(error);
	}
};
