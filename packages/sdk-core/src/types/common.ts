/* eslint-disable @typescript-eslint/no-explicit-any */
export type PartialRecord<K extends keyof any, T> = { [P in K]?: T };

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type CookieOptions = {
	/**
	 * The maximum age of the cookie in seconds. If not specified, the cookie will be a session cookie.
	 */
	maxAge?: number;

	/**
	 * The path attribute of the cookie. Defaults to '/'.
	 *
	 * @default '/'
	 */
	path?: string;

	/**
	 * The domain attribute of the cookie. If not specified, the cookie will be valid for the current domain.
	 */
	domain?: string;

	/**
	 * The SameSite attribute of the cookie. Can be 'strict', 'lax', or 'none'. Defaults to 'lax'.
	 *
	 * @default 'lax'
	 */
	sameSite?: 'strict' | 'lax' | 'none';

	/**
	 * Whether the cookie is secure. If true, the cookie will only be sent over HTTPS. Defaults to true.
	 *
	 * @default true
	 */
	secure?: boolean;
};

export type SDKLogging = {
	/*
	 * Identifier for the login session - can be used to provide additional context for log messages
	 */
	xEventId?: string;

	/**
	 * Logs a debug message with optional context.
	 *
	 * @param {string} message - The debug message to log.
	 */
	debug: (message: string) => void;

	/**
	 * Logs an informational message with optional context.
	 *
	 * @param {string} message - The informational message to log.
	 */
	info: (message: string) => void;

	/**
	 * Logs a warning message with optional context.
	 *
	 * @param {string} message - The warning message to log.
	 */
	warn: (message: string) => void;

	/**
	 * Logs an error message along with an Error object for additional context.
	 *
	 * @param {string} message - The error message to log.
	 * @param {Error} error - The Error object containing additional information about the error.
	 */
	error: (message: string, error: Error) => void;
};

export type SDKStorage<GetArgs extends unknown[] = [], SetArgs extends unknown[] = [], DeleteArgs extends unknown[] = []> = {
	/**
	 * Retrieves an item from the storage by key.
	 *
	 * @param {string} key - The key of the item to retrieve.
	 * @returns {string | null} The value associated with the key, or `null` if not found.
	 */
	get(key: string, ...args: GetArgs): Promise<string | null>;

	/**
	 * Deletes an item from the storage by key.
	 *
	 * @param {string} key - The key of the item to delete.
	 */
	delete(key: string, ...args: DeleteArgs): Promise<void>;

	/**
	 * Sets an item in the storage with the specified key and value.
	 *
	 * @param {string} key - The key to associate with the value.
	 * @param {string} value - The value to store.
	 */
	set(key: string, value: string, ...args: SetArgs): Promise<void>;
};

export type SDKHttpClient = {
	/**
	 * An optional logger instance for logging HTTP requests and responses.
	 */
	logger?: SDKLogging;

	/**
	 * Makes an HTTP request to the specified URL with the given options and returns a response of type T.
	 *
	 * @param {string | URL} url - The URL to which the request is sent.
	 * @param {RequestInit} [options] - Optional configuration for the HTTP request, such as method, headers, and body.
	 * @returns {Promise<HttpClientResponse<T>>} A promise that resolves to the HTTP response containing data of type T.
	 * @throws Will throw an error if the request fails or if the response is not successful (status code not in the range 200-299).
	 */
	request<T>(url: string | URL, options?: RequestInit): Promise<HttpClientResponse<T>>;

	/**
	 * Sends a token request to the specified URL with the provided data and returns a response of type T.
	 *
	 * @param {string | URL} url - The URL to which the token request is sent.
	 * @param {Record<string, string>} data - The data to be sent in the request body, typically including parameters like grant_type, client_id, etc.
	 * @returns {Promise<HttpClientResponse<T>>} A promise that resolves to the HTTP response containing data of type T.
	 * @throws Will throw an error if the request fails or if the response is not successful (status code not in the range 200-299).
	 */
	sendTokenRequest<T>(url: string | URL, data: Record<string, string>): Promise<HttpClientResponse<T>>;
};

export type HttpClientResponse<T> = {
	/**
	 * The headers returned in the HTTP response. This is a Headers object that provides access to the response headers.
	 */
	readonly headers: Headers;

	/**
	 * Indicates whether the HTTP response was successful (status code in the range 200-299).
	 */
	readonly ok: boolean;

	/**
	 * The HTTP status code returned by the server. This is a numeric value that indicates the result of the HTTP request (e.g., 200 for success, 404 for not found).
	 */
	readonly status: number;

	/**
	 * A textual description of the HTTP status code. This provides a human-readable explanation of the status code (e.g., "OK" for 200, "Not Found" for 404).
	 */
	readonly statusText: string;

	/**
	 * The URL of the response. This is the final URL after any redirects that may have occurred during the HTTP request.
	 */
	readonly url: string;

	/**
	 * The raw response body as a ReadableStream, if available. Not supported on all platforms (e.g. native).
	 */
	readonly body?: ReadableStream | null;

	/**
	 * Parses the response body as JSON and returns a promise that resolves to the parsed object of type T.
	 *
	 * @returns {Promise<T>} A promise that resolves to the parsed JSON object of type T.
	 */
	json(): Promise<T>;

	/**
	 * Returns a promise that resolves to the response body as a string.
	 *
	 * @returns {Promise<string>} A promise that resolves to the response body as a string.
	 */
	text(): Promise<string>;
};

export type HttpClientData<T extends (...args: any) => any> = Awaited<ReturnType<T>> extends HttpClientResponse<infer U> ? U : never;
