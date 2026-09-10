import { test, expect } from 'vitest';
import * as nextHooks from '../../../src/client/hooks';
import * as reactHooks from '@strivacity/sdk-react/hooks';

test('re-exports hooks from the react sdk', () => {
	const reactKeys = Object.keys(reactHooks);

	expect(reactKeys.length).toBeGreaterThan(0);
	expect(Object.keys(nextHooks).sort()).toEqual(reactKeys.sort());
});
