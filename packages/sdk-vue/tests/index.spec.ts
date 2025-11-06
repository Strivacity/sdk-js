import { describe, test, expect } from 'vitest';
import * as index from '../src/index';

describe('imports', () => {
	test('should import the correct things from client', () => {
		expect(Object.keys(index)).toHaveLength(12);
		expect(index).toHaveProperty('LocalStorage');
		expect(index).toHaveProperty('SessionStorage');
		expect(index).toHaveProperty('useStrivacity');
		expect(index).toHaveProperty('isAuthenticated');
		expect(index).toHaveProperty('createStrivacitySDK');
		expect(index).toHaveProperty('FallbackError');
		expect(index).toHaveProperty('HttpClient');
		expect(index).toHaveProperty('SDKStorage');
		expect(index).toHaveProperty('SDKHttpClient');
		expect(index).toHaveProperty('getCredential');
		expect(index).toHaveProperty('createCredential');
		expect(index).toHaveProperty('initFlow');
	});
});
