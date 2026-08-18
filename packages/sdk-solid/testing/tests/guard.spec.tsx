import type { RedirectFlow, SDKContext } from '../../src/client/types';
import { describe, test, expect, vi, afterEach } from 'vitest';
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
		const sdk = createMockFlow<RedirectFlow>({ checkAuthentication: vi.fn().mockResolvedValue(false) });
		const Guarded = withAuthGuard(Protected);

		mount(() => (
			<STRIVACITY_SDK value={withContext(sdk, false)}>
				<Guarded label="secret" />
			</STRIVACITY_SDK>
		));
		await flushPromises();

		expect(globalThis.location.href).toContain('/login');

		globalThis.location.href = originalHref;
	});

	test('redirects to a custom loginUri when configured', async () => {
		const originalHref = globalThis.location.href;
		const sdk = createMockFlow<RedirectFlow>({ checkAuthentication: vi.fn().mockResolvedValue(false) });
		const Guarded = withAuthGuard(Protected, { loginUri: '/custom-login' });

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
