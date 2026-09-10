import type { ServerStorage, SDKStorage, RequestEvent, SessionIdCookieStorageOptions } from './types';
import { createSessionIdCookieStorage as createSessionIdCookieStorageBase } from '@strivacity/sdk-core/storages/server';

export * from '@strivacity/sdk-core/storages';

/**
 * Creates a session storage that puts a random unique id value cookie on the client and keeping the actual session data in the given `storage`.
 *
 * @param {SDKStorage} storage - The storage used to persist session data, keyed by a randomly generated session id.
 * @param {SessionIdCookieStorageOptions} [options] - Options for configuring the session-id cookie storage.
 * @returns {ServerStorage} An object implementing the ServerStorage interface for managing sessions indexed by a session-id cookie.
 */
export function createSessionIdCookieStorage(storage: SDKStorage, options?: SessionIdCookieStorageOptions): ServerStorage {
	return createSessionIdCookieStorageBase<RequestEvent | undefined>(
		{
			toRequest: (event) => event!.request,
		},
		storage,
		options,
	);
}
