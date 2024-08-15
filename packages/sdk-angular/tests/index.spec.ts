import { describe, it, expect } from 'vitest';
import * as index from '../src/public-api';

describe('imports', () => {
	it('should import the correct things from client', () => {
		expect(Object.keys(index)).toHaveLength(6);
		expect(index).toHaveProperty('StrivacityAuthModule');
		expect(index).toHaveProperty('StrivacityAuthService');
		expect(index).toHaveProperty('STRIVACITY_SDK');
		expect(index).toHaveProperty('provideStrivacity');
		expect(index).toHaveProperty('LocalStorage');
		expect(index).toHaveProperty('SessionStorage');
	});
});
