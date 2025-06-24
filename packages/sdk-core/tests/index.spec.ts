import { test, expect } from 'vitest';
import * as expectedImports from '../src/index';

test('should export the correct things', () => {
	expect(Object.keys(expectedImports)).toHaveLength(4);
	expect(expectedImports).toHaveProperty('SDKStorage');
	expect(expectedImports).toHaveProperty('SDKHttpClient');
	expect(expectedImports).toHaveProperty('initFlow');
	expect(expectedImports).toHaveProperty('FallbackError');
});
