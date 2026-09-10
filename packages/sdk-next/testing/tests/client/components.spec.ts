import { test, expect } from 'vitest';
import * as nextComponents from '../../../src/client/components';
import * as reactComponents from '@strivacity/sdk-react/components';

test('re-exports components from the react sdk', () => {
	const reactKeys = Object.keys(reactComponents);

	expect(reactKeys.length).toBeGreaterThan(0);
	expect(Object.keys(nextComponents).sort()).toEqual(reactKeys.sort());
});
