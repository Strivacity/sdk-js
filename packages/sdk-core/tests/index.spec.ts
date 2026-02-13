import { test, expect } from 'vitest';
import * as index from '../src/index';

test('should export the correct things', () => {
	expect(Object.keys(index)).toHaveLength(7);
	expect(index).toHaveProperty('SDKStorage');
	expect(index).toHaveProperty('SDKHttpClient');
	expect(index).toHaveProperty('SDKLogging');
	expect(index).toHaveProperty('initFlow');
	expect(index).toHaveProperty('FallbackError');
	expect(index).toHaveProperty('PopupBlockedError');
	expect(index).toHaveProperty('PopupClosedError');
});
