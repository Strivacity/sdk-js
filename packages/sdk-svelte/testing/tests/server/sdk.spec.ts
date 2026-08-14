import type { RequestEvent } from '@sveltejs/kit';
import type { BaseServerSDK } from '@strivacity/sdk-core/types';
import type { SvelteKitServerSDK, SvelteKitServerSDKInitConfig } from '../../../src/server/types';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { createMockBaseServerSDK } from '@strivacity/testing/mocks/sdk';
import { createServerSDK } from '../../../src/server/sdk';

vi.mock('@strivacity/sdk-core/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core/server')>()),
	createBaseServerSDK: vi.fn(),
}));

const validInitConfig: SvelteKitServerSDKInitConfig = {
	issuer: 'https://brandtegrity.io',
	clientId: 'client-id',
	redirectUri: 'https://brandtegrity.io/callback',
	secret: 'secret',
};

function installBase(overrides?: Record<string, unknown>) {
	const base = createMockBaseServerSDK<BaseServerSDK<RequestEvent>>(overrides);
	vi.mocked(createBaseServerSDK).mockReturnValue(base);

	return base;
}

function createEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
	return {
		request: new Request('https://brandtegrity.io/profile'),
		url: new URL('https://brandtegrity.io/profile'),
		...overrides,
	} as RequestEvent;
}

beforeEach(() => {
	vi.mocked(createBaseServerSDK).mockReset();
});

describe('createServerSDK', () => {
	test('creates the base server sdk with a toRequest adapter reading event.request, and the given config', () => {
		installBase();

		createServerSDK(validInitConfig);

		expect(createBaseServerSDK).toHaveBeenCalledTimes(1);
		const [adapter, forwardedConfig] = vi.mocked(createBaseServerSDK).mock.calls[0];
		expect(forwardedConfig).toBe(validInitConfig);

		const event = createEvent();
		expect(adapter.toRequest(event)).toBe(event.request);
	});

	test('exposes the underlying options', () => {
		const base = installBase({ options: { mode: 'redirect', authUrlPrefix: '/auth' } });
		const sdk = createServerSDK(validInitConfig);

		expect(sdk.options).toBe(base.options);
	});

	describe('pass-through methods', () => {
		const event = createEvent();

		test.each([
			['getSession', [event]],
			['updateSession', [{ access_token: 'a' }, event]],
			['refreshSession', [event]],
			['revokeSession', [event]],
			['getEntrySession', ['https://brandtegrity.io/entry']],
			['completeLogin', [{ code: 'abc' }, event]],
			['logout', ['https://brandtegrity.io', event]],
			['handleLogin', [event]],
			['handleRegister', [event]],
			['handleCallback', [event]],
			['handleRefresh', [event]],
			['handleRevoke', [event]],
			['handleEntry', [event]],
			['handleLogout', [event]],
			['handleBackChannelLogout', [event]],
			['handler', [event]],
		] as const)('%s calls through to the base server sdk with the same arguments and return value', async (method, args) => {
			const base = installBase();
			const sdk = createServerSDK(validInitConfig);

			const result = await (sdk[method as keyof SvelteKitServerSDK] as (...a: Array<unknown>) => unknown)(...args);
			// indexed through a plain Record (rather than the method-shorthand-typed BaseServerSDK) so the mock
			// function reference isn't flagged as an unbound method
			const baseAsRecord = base as unknown as Record<string, ReturnType<typeof vi.fn>>;
			const baseMock = baseAsRecord[method];

			expect(baseMock).toHaveBeenCalledWith(...args);
			expect(result).toEqual(await baseMock.mock.results[0].value);
		});
	});

	describe('handle', () => {
		test('returns the base handler response unchanged when it resolves one, without calling resolve', async () => {
			const response = new Response(null, { status: 200 });
			const base = installBase({ handler: vi.fn().mockResolvedValue(response) });
			const sdk = createServerSDK(validInitConfig);
			const event = createEvent();
			const resolve = vi.fn();

			const result = await sdk.handle({ event, resolve });

			expect(base.handler).toHaveBeenCalledWith(event);
			expect(result).toBe(response);
			expect(resolve).not.toHaveBeenCalled();
		});

		test('falls back to resolve(event) when the base handler resolves null', async () => {
			installBase({ handler: vi.fn().mockResolvedValue(null) });
			const sdk = createServerSDK(validInitConfig);
			const event = createEvent();
			const resolveResult = new Response('ok');
			const resolve = vi.fn().mockResolvedValue(resolveResult);

			const result = await sdk.handle({ event, resolve });

			expect(resolve).toHaveBeenCalledWith(event);
			expect(result).toBe(resolveResult);
		});
	});

	describe('requireSession', () => {
		test('returns the session unchanged when it is still valid', async () => {
			const session = { access_token: 'a', expires_at: Math.floor(Date.now() / 1000) + 3600 };
			const base = installBase({ getSession: vi.fn().mockResolvedValue(session) });
			const sdk = createServerSDK(validInitConfig);

			await expect(sdk.requireSession(createEvent())).resolves.toBe(session);
			expect(base.refreshSession).not.toHaveBeenCalled();
		});

		test('refreshes an expired session that still has a refresh token', async () => {
			const expiredSession = { access_token: 'a', expires_at: 0, refresh_token: 'r' };
			const refreshedSession = { access_token: 'b', expires_at: Math.floor(Date.now() / 1000) + 3600 };
			const base = installBase({
				getSession: vi.fn().mockResolvedValue(expiredSession),
				refreshSession: vi.fn().mockResolvedValue(refreshedSession),
			});
			const sdk = createServerSDK(validInitConfig);
			const event = createEvent();

			await expect(sdk.requireSession(event)).resolves.toBe(refreshedSession);
			expect(base.refreshSession).toHaveBeenCalledWith(event);
		});

		test('redirects when refreshing an expired session throws instead of propagating the refresh error', async () => {
			const expiredSession = { access_token: 'a', expires_at: 0, refresh_token: 'r' };
			installBase({
				options: { mode: 'redirect', authUrlPrefix: '/auth' },
				getSession: vi.fn().mockResolvedValue(expiredSession),
				refreshSession: vi.fn().mockRejectedValue(new Error('refresh failed')),
			});
			const sdk = createServerSDK(validInitConfig);

			const error = await sdk.requireSession(createEvent()).catch((error: unknown) => error);
			expect(isRedirect(error)).toBe(true);
		});

		test('returns an expired session unrefreshed, without redirecting, when it has no refresh token', async () => {
			// the guard only redirects when there is no session at all; an expired-but-unrefreshable session is
			// still handed back as-is rather than forced through login again.
			const expiredSession = { access_token: 'a', expires_at: 0 };
			const base = installBase({ options: { mode: 'redirect', authUrlPrefix: '/auth' }, getSession: vi.fn().mockResolvedValue(expiredSession) });
			const sdk = createServerSDK(validInitConfig);

			await expect(sdk.requireSession(createEvent())).resolves.toBe(expiredSession);
			expect(base.refreshSession).not.toHaveBeenCalled();
		});

		test('redirects to the authUrlPrefix login route with a returnTo defaulting to the current path, in non-embedded/native modes', async () => {
			installBase({ options: { mode: 'redirect', authUrlPrefix: '/auth' }, getSession: vi.fn().mockResolvedValue(null) });
			const sdk = createServerSDK(validInitConfig);
			const event = createEvent({ url: new URL('https://brandtegrity.io/profile?tab=security') });

			const error = (await sdk.requireSession(event).catch((error: unknown) => error)) as { status: number; location: string };

			expect(isRedirect(error)).toBe(true);
			expect(error.status).toBe(302);
			expect(error.location).toBe('https://brandtegrity.io/auth/login?returnTo=%2Fprofile%3Ftab%3Dsecurity');
		});

		test('redirects to options.loginUri instead, in embedded/native modes', async () => {
			installBase({ options: { mode: 'native', loginUri: '/native-login' }, getSession: vi.fn().mockResolvedValue(null) });
			const sdk = createServerSDK(validInitConfig);
			const event = createEvent({ url: new URL('https://brandtegrity.io/app') });

			const error = (await sdk.requireSession(event).catch((error: unknown) => error)) as { location: string };

			expect(error.location).toBe('https://brandtegrity.io/native-login?returnTo=%2Fapp');
		});

		test('uses a given returnTo option instead of the current path', async () => {
			installBase({ options: { mode: 'redirect', authUrlPrefix: '/auth' }, getSession: vi.fn().mockResolvedValue(null) });
			const sdk = createServerSDK(validInitConfig);

			const error = (await sdk.requireSession(createEvent(), { returnTo: '/custom' }).catch((error: unknown) => error)) as { location: string };

			expect(error.location).toBe('https://brandtegrity.io/auth/login?returnTo=%2Fcustom');
		});

		test('omits the returnTo query param entirely when it resolves to an empty string', async () => {
			installBase({ options: { mode: 'redirect', authUrlPrefix: '/auth' }, getSession: vi.fn().mockResolvedValue(null) });
			const sdk = createServerSDK(validInitConfig);

			const error = (await sdk.requireSession(createEvent(), { returnTo: '' }).catch((error: unknown) => error)) as { location: string };

			expect(error.location).toBe('https://brandtegrity.io/auth/login');
		});
	});
});
