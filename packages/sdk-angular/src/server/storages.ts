import type { ServerStorage, AngularServerRequest } from './types';
import type { SDKStorage, SessionIdCookieStorageOptions } from '@strivacity/sdk-core/types';
import { createSessionIdCookieStorage as createSessionIdCookieStorageBase } from '@strivacity/sdk-core/storages/server';
import { toWebRequest } from './utils';

export * from '@strivacity/sdk-core/storages';

/**
 * Creates a session storage that puts a random unique id value cookie on the client and keeping the actual session data in the given `storage`.
 *
 * @param {SDKStorage} storage - The storage used to persist session data, keyed by a randomly generated session id.
 * @param {SessionIdCookieStorageOptions} [options] - Options for the session ID cookie, including default cookie attributes and a UUID generator function.
 * @param {Partial<ServerCookieOptions>} [options.defaultCookieOptions] - Default cookie attributes for the session ID cookie.
 * @param {() => string} [options.uuidGenerator] - Function to generate a new UUID for the session ID. Defaults to `() => crypto.randomUUID()`.
 * @returns {ServerStorage} An object implementing the ServerStorage interface for managing sessions indexed by a session-id cookie.
 */
export function createSessionIdCookieStorage(storage: SDKStorage, options?: SessionIdCookieStorageOptions): ServerStorage {
	return createSessionIdCookieStorageBase<AngularServerRequest>(
		{
			toRequest: (req) => toWebRequest(req),
		},
		storage,
		options,
	);
}
