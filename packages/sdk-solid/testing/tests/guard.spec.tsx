import type { RedirectFlow, SDKContext } from '../../src/client/types';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { createSignal } from 'solid-js';
import { STRIVACITY_SDK, withAuthGuard } from '../../src/client/hooks';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { mount, cleanupMounts, flush } from '../dom';

afterEach(() => {
	cleanupMounts();
});

function withContext(sdk: RedirectFlow, loading: boolean): SDKContext<RedirectFlow> {
	return { sdk, loading: () => loading } as unknown as SDKContext<RedirectFlow>;
}

function Protected(props: { label: string }) {
	return <div data-testid="protected">{props.label}</div>;
}

describe('withAuthGuard', () => {
	test('reads the sdk lazily, so it works when the provider creates the sdk after the guard has rendered (first load)', async () => {
		const sdk = createMockFlow<RedirectFlow>({ checkAuthentication: vi.fn().mockResolvedValue(true) });
		const [loading, setLoading] = createSignal(true);
		let createdSdk: RedirectFlow | undefined = undefined;
		const context = {
			get sdk() {
				return createdSdk;
			},
			loading,
		} as unknown as SDKContext<RedirectFlow>;
		const Guarded = withAuthGuard(Protected);

		const { container } = mount(() => (
			<STRIVACITY_SDK value={context}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));

		createdSdk = sdk;
		setLoading(false);
		flush();
		await flushPromises();

		expect(sdk.checkAuthentication).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe('secret');
	});

	test('with server-managed sessions, sends an expired session through the server refresh route instead of login', async () => {
		const originalHref = globalThis.location.href;
		const sdk = createMockFlow<RedirectFlow>({
			checkAuthentication: vi.fn().mockResolvedValue(false),
			options: { serverSessionUri: '/auth/login' },
			session: { access_token: 'expired' },
		});
		const Guarded = withAuthGuard(Protected);

		mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, false)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));
		await flushPromises();

		expect(sdk.refresh).toHaveBeenCalledTimes(1);
		expect(globalThis.location.href).toBe(originalHref);
	});

	test('renders nothing while the sdk is still loading', () => {
		const sdk = createMockFlow<RedirectFlow>();
		const Guarded = withAuthGuard(Protected);

		const { container } = mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, true)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));

		expect(container.textContent).toBe('');
		expect(sdk.checkAuthentication).not.toHaveBeenCalled();
	});

	test('renders the given onLoading placeholder while loading', () => {
		const sdk = createMockFlow<RedirectFlow>();
		const Guarded = withAuthGuard(Protected, { onLoading: () => <div>loading…</div> });

		const { container } = mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, true)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));

		expect(container.textContent).toBe('loading…');
	});

	test('checks authentication through the sdk once loading finishes, and renders the wrapped component when authenticated', async () => {
		const sdk = createMockFlow<RedirectFlow>({ checkAuthentication: vi.fn().mockResolvedValue(true) });
		const Guarded = withAuthGuard(Protected);

		const { container } = mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, false)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));
		await flushPromises();

		expect(sdk.checkAuthentication).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe('secret');
	});

	test('redirects to the default login URI when checkAuthentication resolves false', async () => {
		const originalHref = globalThis.location.href;
		const currentPath = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
		const sdk = createMockFlow<RedirectFlow>({ checkAuthentication: vi.fn().mockResolvedValue(false) });
		const Guarded = withAuthGuard(Protected);

		mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, false)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));
		await flushPromises();

		// the protected page is handed to the login page, which passes it on to login({ returnTo })
		expect(globalThis.location.href).toContain(`/login?returnTo=${encodeURIComponent(currentPath)}`);

		globalThis.location.href = originalHref;
	});

	test('redirects to a custom loginPageUri when configured', async () => {
		const originalHref = globalThis.location.href;
		const sdk = createMockFlow<RedirectFlow>({ checkAuthentication: vi.fn().mockResolvedValue(false) });
		const Guarded = withAuthGuard(Protected, { loginPageUri: '/custom-login' });

		mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, false)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));
		await flushPromises();

		expect(globalThis.location.href).toContain('/custom-login');

		globalThis.location.href = originalHref;
	});

	test('ignores a checkAuthentication result that resolves after the component has unmounted', async () => {
		let resolveCheck!: (value: boolean) => void;
		const sdk = createMockFlow<RedirectFlow>({
			checkAuthentication: vi.fn(
				() =>
					new Promise<boolean>((resolve) => {
						resolveCheck = resolve;
					}),
			),
		});
		const Guarded = withAuthGuard(Protected);

		mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, false)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));
		await flushPromises();

		cleanupMounts();

		expect(() => {
			resolveCheck(true);
			flush();
		}).not.toThrow();
	});
});
