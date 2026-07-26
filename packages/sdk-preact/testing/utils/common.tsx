import type { VNode } from 'preact';
import type { LoginContext, NativeFlow, RedirectFlow, SDKContext, UseNativeLoginOptions } from '../../src/types';
import { render } from 'preact';
import { act as preactAct } from 'preact/test-utils';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { STRIVACITY_SDK, useNativeLogin } from '../../src';

export const act = preactAct;

const mountedContainers: Array<HTMLElement> = [];

export function mount(element: VNode): { container: HTMLElement; rerender: (next: VNode) => void } {
	const container = document.createElement('div');
	document.body.appendChild(container);

	try {
		void act(() => {
			render(element, container);
		});
	} catch (error) {
		container.remove();
		throw error;
	}

	mountedContainers.push(container);

	return {
		container,
		rerender: (next: VNode) => {
			void act(() => {
				render(next, container);
			});
		},
	};
}

export function mountNativeLogin(sdk: NativeFlow, options: UseNativeLoginOptions = {}) {
	let latest!: LoginContext;

	function Probe() {
		latest = useNativeLogin(options);
		return null;
	}

	mount(
		<STRIVACITY_SDK.Provider value={{ sdk } as unknown as SDKContext<NativeFlow>}>
			<Probe />
		</STRIVACITY_SDK.Provider>,
	);

	return { getLogin: () => latest };
}

export function cleanupMounts(): void {
	while (mountedContainers.length > 0) {
		const container = mountedContainers.pop()!;

		void act(() => {
			render(null, container);
		});
		container.remove();
	}
}

export async function flush(): Promise<void> {
	await act(async () => {
		await flushPromises();
	});
}

export function withContext(sdk: RedirectFlow, loading: boolean) {
	return { sdk, loading } as unknown as SDKContext<RedirectFlow>;
}
