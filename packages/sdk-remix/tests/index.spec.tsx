import { describe, it, expect } from 'vitest';
import * as index from '../src/index';

describe('imports', () => {
	it('should import the correct things from client', () => {
		expect(Object.keys(index)).toHaveLength(11);
		expect(index).toHaveProperty('LocalStorage');
		expect(index).toHaveProperty('SessionStorage');
		expect(index).toHaveProperty('useStrivacity');
		expect(index).toHaveProperty('StyAuthProvider');
		expect(index).toHaveProperty('StyLoginRenderer');
		expect(index).toHaveProperty('NativeFlowContext');
		expect(index).toHaveProperty('FallbackError');
		expect(index).toHaveProperty('HttpClient');
		expect(index).toHaveProperty('SDKStorage');
		expect(index).toHaveProperty('SDKHttpClient');
		expect(index).toHaveProperty('initFlow');
	});
});
