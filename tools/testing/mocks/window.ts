import { vi } from 'vitest';

export type FakePopup = {
	closed: boolean;
	focus: () => void;
	close: () => void;
	location: { replace: (url: string | URL) => void };
};

export function createFakePopup(): FakePopup {
	const popup: FakePopup = {
		closed: false,
		focus: vi.fn(),
		close: vi.fn(),
		location: { replace: vi.fn() },
	};

	popup.close = vi.fn(() => {
		popup.closed = true;
	});

	return popup;
}

export function postMessageFromPopup(source: unknown, data: Record<string, string>): void {
	window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin, source: source as Window }));
}
