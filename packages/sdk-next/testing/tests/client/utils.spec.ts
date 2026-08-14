import { test, expect } from 'vitest';
import * as nextUtils from '../../../src/client/utils';
import * as reactUtils from '@strivacity/sdk-react/utils';

test('re-exports utilities from the react sdk', () => {
	const reactKeys = Object.keys(reactUtils);

	expect(reactKeys.length).toBeGreaterThan(0);
	expect(Object.keys(nextUtils).sort()).toEqual(reactKeys.sort());
});
