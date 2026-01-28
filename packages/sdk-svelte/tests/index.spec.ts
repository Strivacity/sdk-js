import { describe, test, expect } from 'vitest';
import * as index from '../src/index';

describe('imports', () => {
	test('should import the correct things from sdk', () => {
		expect(Object.keys(index)).toHaveLength(14);
		expect(index).toHaveProperty('HttpClient');
		expect(index).toHaveProperty('DefaultLogging');
		expect(index).toHaveProperty('LocalStorage');
		expect(index).toHaveProperty('SessionStorage');
		expect(index).toHaveProperty('createCredential');
		expect(index).toHaveProperty('getCredential');
		expect(index).toHaveProperty('useStrivacity');
		expect(index).toHaveProperty('StyAuthProvider');
		expect(index).toHaveProperty('StyLoginRenderer');
		expect(index).toHaveProperty('FallbackError');
		expect(index).toHaveProperty('SDKHttpClient');
		expect(index).toHaveProperty('SDKLogging');
		expect(index).toHaveProperty('SDKStorage');
		expect(index).toHaveProperty('initFlow');
	});
});
