import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@nuxt/kit', () => ({
	defineNuxtModule: (definition: unknown) => definition,
	createResolver: () => ({ resolve: (path: string) => path }),
	resolvePath: (path: string) => Promise.resolve(path),
	addImportsDir: vi.fn(),
	addServerImportsDir: vi.fn(),
	addServerHandler: vi.fn(),
	addServerPlugin: vi.fn(),
	addRouteMiddleware: vi.fn(),
	addPlugin: vi.fn(),
}));

function createNuxt() {
	return { options: { runtimeConfig: { public: {} }, alias: {}, nitro: { alias: {} } } };
}

type ModuleDefinition = { setup: (options: Record<string, unknown>, nuxt: ReturnType<typeof createNuxt>) => Promise<void> };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('sdk-nuxt module', () => {
	test('prepends its session middleware, so app middleware (incl. *.global.ts) already sees the loaded session', async () => {
		const kit = await import('@nuxt/kit');
		const module = (await import('../../src/module')).default as unknown as ModuleDefinition;

		await module.setup({ issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback' }, createNuxt());

		expect(kit.addRouteMiddleware).toHaveBeenCalledWith(expect.objectContaining({ name: 'strivacity', global: true }), { prepend: true });
	});

	test('does not register the session middleware with client-managed sessions', async () => {
		const kit = await import('@nuxt/kit');
		const module = (await import('../../src/module')).default as unknown as ModuleDefinition;

		await module.setup(
			{ issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback', serverSessionUri: null },
			createNuxt(),
		);

		expect(kit.addRouteMiddleware).not.toHaveBeenCalled();
	});

	test('keeps the secrets and the client authentication out of the public runtime config', async () => {
		const module = (await import('../../src/module')).default as unknown as ModuleDefinition;
		const nuxt = createNuxt();

		await module.setup(
			{
				issuer: 'https://brandtegrity.io',
				clientId: 'client-id',
				redirectUri: 'https://brandtegrity.io/callback',
				cookieSecret: 'cookie-secret',
				clientSecret: 'client-secret',
				tokenEndpointAuthMethod: 'client_secret_basic',
			},
			nuxt,
		);

		const publicConfig = JSON.stringify(nuxt.options.runtimeConfig.public);

		expect(publicConfig).not.toContain('cookie-secret');
		expect(publicConfig).not.toContain('client-secret');
		expect(publicConfig).not.toContain('tokenEndpointAuthMethod');
		expect(nuxt.options.runtimeConfig).toMatchObject({ strivacity: { clientSecret: 'client-secret', tokenEndpointAuthMethod: 'client_secret_basic' } });
	});
});
