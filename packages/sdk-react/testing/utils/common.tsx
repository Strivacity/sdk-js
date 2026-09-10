import type { ReactElement } from 'react';
import type { RedirectFlow, SDKContext } from '../../src/types';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushPromises } from '@strivacity/testing/mocks/common';

export { act };

// Tells React it's safe to batch/flush effects synchronously inside act() in this non-DOM-testing-library environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = [];

export function mount(element: ReactElement): { container: HTMLElement; rerender: (next: ReactElement) => void } {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);

	try {
		act(() => {
			root.render(element);
		});
	} catch (error) {
		container.remove();
		throw error;
	}

	mountedRoots.push({ root, container });

	return {
		container,
		rerender: (next: ReactElement) => {
			act(() => {
				root.render(next);
			});
		},
	};
}

export function cleanupMounts(): void {
	while (mountedRoots.length > 0) {
		const entry = mountedRoots.pop()!;

		act(() => {
			entry.root.unmount();
		});
		entry.container.remove();
	}
}

/**
 * Lets pending microtasks (promise chains started from an effect) resolve, inside an `act()`
 * call so any resulting state updates are flushed and applied before the assertions that follow.
 */
export async function flush(): Promise<void> {
	await act(async () => {
		await flushPromises();
	});
}

export function withContext(sdk: RedirectFlow, loading: boolean) {
	return { sdk, loading } as unknown as SDKContext<RedirectFlow>;
}
