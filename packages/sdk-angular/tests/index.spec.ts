import { describe, test, expect } from 'vitest';
import * as index from '../src/public-api';

describe('imports', () => {
	test('should import the correct things from client', () => {
		expect(Object.keys(index)).toHaveLength(15);
		expect(index).toHaveProperty('LocalStorage');
		expect(index).toHaveProperty('SessionStorage');
		expect(index).toHaveProperty('StyLoginRenderer');
		expect(index).toHaveProperty('StrivacityAuthService');
		expect(index).toHaveProperty('StrivacityWidgetService');
		expect(index).toHaveProperty('STRIVACITY_SDK');
		expect(index).toHaveProperty('provideStrivacity');
		expect(index).toHaveProperty('StrivacityAuthModule');
		expect(index).toHaveProperty('FallbackError');
		expect(index).toHaveProperty('HttpClient');
		expect(index).toHaveProperty('SDKStorage');
		expect(index).toHaveProperty('SDKHttpClient');
		expect(index).toHaveProperty('getCredential');
		expect(index).toHaveProperty('createCredential');
		expect(index).toHaveProperty('initFlow');
	});
});
