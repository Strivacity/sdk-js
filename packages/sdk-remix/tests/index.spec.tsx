import { describe, it, expect } from 'vitest';
import * as index from '../src/index';

describe('imports', () => {
	it('should import the correct things from client', () => {
		expect(Object.keys(index)).toHaveLength(4);
		expect(index).toHaveProperty('AuthProvider');
		expect(index).toHaveProperty('useStrivacity');
		expect(index).toHaveProperty('LocalStorage');
		expect(index).toHaveProperty('SessionStorage');
	});
});
