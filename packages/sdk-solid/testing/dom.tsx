import type { JSX } from '@solidjs/web';
import { render } from '@solidjs/web';

/**
 * Drains @solidjs/signals' pending write queue. A setter called from plain test code (outside any Solid-owned
 * computation) queues its write into the next flush instead of applying it inline - a signal read in the very
 * same synchronous tick still sees the old value. Call this right after such a setter call, before reading.
 * Writes made from inside the component tree's own effects/promise continuations (the common case exercised via
 * `await flushPromises()`) are auto-flushed through a queued microtask and don't need this.
 */
export { flush } from 'solid-js';

const disposers: Array<() => void> = [];

/**
 * Mounts the given component into a fresh, document-attached container using Solid's own `render()`.
 * Solid's reactivity is synchronous fine-grained tracking (not a virtual-DOM diff/commit cycle), so unlike
 * React there is no `act()`-equivalent needed to see the effects of a signal update.
 */
export function mount(code: () => JSX.Element): { container: HTMLElement } {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const dispose = render(code, container);

	disposers.push(dispose);

	return { container };
}

/**
 * Disposes every component mounted since the last cleanup, running each `onSettled` cleanup callback and removing its container from the document.
 */
export function cleanupMounts(): void {
	while (disposers.length > 0) {
		const dispose = disposers.pop()!;
		dispose();
	}

	document.body.innerHTML = '';
}
