import { it, expect } from 'vitest';
import * as expectedImports from '../src/index';

it('should export the correct things', () => {
	expect(Object.keys(expectedImports)).toHaveLength(1);
	expect(expectedImports).toHaveProperty('initFlow');
});
