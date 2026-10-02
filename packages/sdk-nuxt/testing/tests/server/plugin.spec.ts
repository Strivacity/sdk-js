import type { NitroApp } from 'nitropack/types';
import type { H3Event } from 'h3';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockStorage, createServerOptions, getMockStorage } from '@strivacity/testing/mocks/sdk';
import { createFakeH3Event } from '../../utils/http';

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.doUnmock('#imports');
	vi.doUnmock('#strivacity-options-storage');
	vi.doUnmock('#strivacity-options-stateStorage');
	vi.doUnmock('#strivacity-options-logging');
	vi.doUnmock('#strivacity-options-httpClient');
});

function createFakeNitroApp() {
	const hook = vi.fn();

	return { app: { hooks: { hook } } as unknown as NitroApp, hook };
}

async function installPlugin(strivacityConfig: Record<string, unknown>) {
	vi.doMock('#imports', () => ({ useRuntimeConfig: () => ({ strivacity: strivacityConfig }) }));

	const plugin = (await import('../../../src/runtime/server/plugins/auth.server')).default;
	const { app, hook } = createFakeNitroApp();

	plugin(app);

	// The "request" hook is registered synchronously by the plugin itself, before any of the awaited
	// '#strivacity-options-*' dynamic imports resolve - the hook function is what awaits readiness.
	expect(hook).toHaveBeenCalled();
	const requestHook = hook.mock.calls[0]?.[1] as ((event: H3Event) => Promise<void>) | undefined;

	return { hook, requestHook };
}

describe('auth.server nitro plugin', () => {
	test('registers the "request" hook synchronously, before the async option-factory imports resolve', async () => {
		let resolveStorageImport: (mod: { default: () => undefined }) => void = () => undefined;
		vi.doMock('#strivacity-options-storage', () => new Promise((resolve) => (resolveStorageImport = resolve)));
		vi.doMock('#imports', () => ({
			useRuntimeConfig: () => ({ strivacity: createServerOptions({ storage: createMockStorage(), stateStorage: createMockStorage() }) }),
		}));

		const plugin = (await import('../../../src/runtime/server/plugins/auth.server')).default;
		const { app, hook } = createFakeNitroApp();

		plugin(app);

		// the hook must already be registered even though the '#strivacity-options-storage' import above
		// is still pending - a request arriving this early must not slip past the hook entirely.
		expect(hook).toHaveBeenCalledWith('request', expect.any(Function));

		resolveStorageImport({ default: () => undefined });
	});

	test('registers a "request" hook that wires a fully-shaped sdk onto the event context', async () => {
		const storage = createMockStorage();
		const stateStorage = createMockStorage();
		const { hook, requestHook } = await installPlugin(createServerOptions({ storage, stateStorage }));

		expect(hook).toHaveBeenCalledWith('request', expect.any(Function));

		const event = { context: {} } as unknown as H3Event;
		await requestHook!(event);

		const sdk = event.context.strivacity.sdk;
		expect(sdk.options).toBeDefined();

		for (const method of [
			'getSession',
			'updateSession',
			'refreshSession',
			'revokeSession',
			'getEntrySession',
			'completeLogin',
			'logout',
			'handleLogin',
			'handleRegister',
			'handleCallback',
			'handleRefresh',
			'handleRevoke',
			'handleEntry',
			'handleLogout',
			'handleBackChannelLogout',
			'handler',
		] as const) {
			expect(typeof sdk[method]).toBe('function');
		}
	});

	test('delegates getSession/updateSession to the underlying base server sdk against the configured storage', async () => {
		const storage = createMockStorage();
		const stateStorage = createMockStorage();
		const { requestHook } = await installPlugin(createServerOptions({ storage, stateStorage }));

		const event = { context: {} } as unknown as H3Event;
		await requestHook!(event);
		const sdk = event.context.strivacity.sdk;

		await expect(sdk.getSession()).resolves.toBeNull();

		const session = getMockStorage(storage).generateSession(undefined, null);
		await sdk.updateSession(session);

		await expect(sdk.getSession()).resolves.toEqual(session);
	});

	test('does not replace an sdk that a previous hook already wired onto the event context', async () => {
		const { requestHook } = await installPlugin(createServerOptions({ storage: createMockStorage(), stateStorage: createMockStorage() }));

		const existingSdk = { marker: 'existing' };
		const event = { context: { strivacity: { sdk: existingSdk } } } as unknown as H3Event;
		await requestHook!(event);

		expect(event.context.strivacity.sdk).toBe(existingSdk);
	});

	test('prefers a custom storage/stateStorage/logging/httpClient supplied through the #strivacity-options-* factories over the runtime config', async () => {
		const customStorage = createMockStorage();
		const customStateStorage = createMockStorage();
		const customLogging = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const customHttpClient = { request: vi.fn(), sendTokenRequest: vi.fn() };

		vi.doMock('#strivacity-options-storage', () => ({ default: () => customStorage }));
		vi.doMock('#strivacity-options-stateStorage', () => ({ default: () => customStateStorage }));
		vi.doMock('#strivacity-options-logging', () => ({ default: () => customLogging }));
		vi.doMock('#strivacity-options-httpClient', () => ({ default: () => customHttpClient }));

		const configuredStorage = createMockStorage();
		const { requestHook } = await installPlugin(createServerOptions({ storage: configuredStorage, stateStorage: createMockStorage() }));

		const event = { context: {} } as unknown as H3Event;
		await requestHook!(event);
		const sdk = event.context.strivacity.sdk;

		const session = getMockStorage(customStorage).generateSession(undefined, null);
		await sdk.updateSession(session);

		expect(getMockStorage(configuredStorage).keys()).toEqual([]);
		await expect(sdk.getSession()).resolves.toEqual(session);
	});

	test('falls back to an encrypted cookie storage keyed by the configured secret when no storage is configured', async () => {
		const { requestHook } = await installPlugin(createServerOptions({ storage: undefined, stateStorage: createMockStorage(), secret: 'secret' }));

		const event = createFakeH3Event();

		await expect(requestHook!(event)).resolves.toBeUndefined();
		await expect(event.context.strivacity.sdk.getSession()).resolves.toBeNull();
	});

	test('logs the error and wires a stub sdk that fails every request with a clear 500, instead of silently leaving the context unset, when setup fails (e.g. missing secret)', async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const { requestHook } = await installPlugin(createServerOptions({ storage: undefined, stateStorage: createMockStorage(), secret: undefined }));

		const event = { context: {} } as unknown as H3Event;
		await requestHook!(event);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'[@strivacity/sdk-nuxt] Failed to initialize the Strivacity server SDK:',
			expect.objectContaining({ message: 'Secret is required for encrypted cookie storage' }),
		);

		expect(() => event.context.strivacity.sdk.getSession()).toThrow(
			expect.objectContaining({ statusCode: 500, statusMessage: 'Strivacity SDK failed to initialize' }),
		);

		consoleErrorSpy.mockRestore();
	});
});
