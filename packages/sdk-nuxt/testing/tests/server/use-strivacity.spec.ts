import type { H3Event } from 'h3';
import { describe, test, expect } from 'vitest';
import { useStrivacity } from '../../../src/runtime/server/composables/use-strivacity';

describe('useStrivacity (server composable)', () => {
	test('returns the sdk instance wired onto the event context by the auth.server nitro plugin', () => {
		const sdk = { getSession: () => Promise.resolve(null) };
		const event = { context: { strivacity: { sdk } } } as unknown as H3Event;

		expect(useStrivacity(event)).toBe(sdk);
	});

	test('throws when called without an event', () => {
		expect(() => useStrivacity(undefined as unknown as H3Event)).toThrow('useStrivacity() can not be called without passing an H3Event instance.');
	});

	// NOTE: the "throws when called from the client" guard (`if (import.meta.client)`) can't be
	// exercised here - import.meta.client is only ever set to a truthy compile-time constant by
	// Nuxt's own Vite plugin during a real build, which this bare vitest config doesn't run.
	// import.meta.client is falsy in this harness, i.e. it always presents as "server", which is
	// the environment this composable is actually meant to run in.
});
