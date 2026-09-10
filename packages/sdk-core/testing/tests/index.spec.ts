import { describe, test, expect, vi, afterEach } from 'vitest';
import { createOptions } from '@strivacity/testing/mocks/sdk';
import * as index from '../../src/index';
import { UnsupportedFlowError } from '../../src/utils/errors';
import { createRedirectFlow } from '../../src/flows/redirect';
import { createPopupFlow } from '../../src/flows/popup';
import { createEmbeddedFlow } from '../../src/flows/embedded';
import { createNativeFlow } from '../../src/flows/native';

vi.mock('../../src/flows/redirect');
vi.mock('../../src/flows/popup');
vi.mock('../../src/flows/embedded');
vi.mock('../../src/flows/native');

test('should export the correct things', () => {
	const expectedExports = ['initFlow'];

	expect(Object.keys(index)).toEqual(expectedExports);
});

describe('initFlow', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('mode: "redirect"', () => {
		const options = createOptions({ mode: 'redirect' });
		const flow = { type: 'redirect' };
		vi.mocked(createRedirectFlow).mockReturnValue(flow);

		expect(index.initFlow(options as never)).toBe(flow);
		expect(createRedirectFlow).toHaveBeenCalledWith(options);
		expect(createPopupFlow).not.toHaveBeenCalled();
		expect(createEmbeddedFlow).not.toHaveBeenCalled();
		expect(createNativeFlow).not.toHaveBeenCalled();
	});

	test('mode: "popup"', () => {
		const options = createOptions({ mode: 'popup' });
		const flow = { type: 'popup' };
		vi.mocked(createPopupFlow).mockReturnValue(flow);

		expect(index.initFlow(options as never)).toBe(flow);
		expect(createPopupFlow).toHaveBeenCalledWith(options);
		expect(createRedirectFlow).not.toHaveBeenCalled();
		expect(createEmbeddedFlow).not.toHaveBeenCalled();
		expect(createNativeFlow).not.toHaveBeenCalled();
	});

	test('mode: "embedded"', () => {
		const options = createOptions({ mode: 'embedded' });
		const flow = { type: 'embedded' };
		vi.mocked(createEmbeddedFlow).mockReturnValue(flow);

		expect(index.initFlow(options as never)).toBe(flow);
		expect(createEmbeddedFlow).toHaveBeenCalledWith(options);
		expect(createRedirectFlow).not.toHaveBeenCalled();
		expect(createPopupFlow).not.toHaveBeenCalled();
		expect(createNativeFlow).not.toHaveBeenCalled();
	});

	test('mode: "native"', () => {
		const options = createOptions({ mode: 'native' });
		const flow = { type: 'native' };
		vi.mocked(createNativeFlow).mockReturnValue(flow);

		expect(index.initFlow(options as never)).toBe(flow);
		expect(createNativeFlow).toHaveBeenCalledWith(options);
		expect(createRedirectFlow).not.toHaveBeenCalled();
		expect(createPopupFlow).not.toHaveBeenCalled();
		expect(createEmbeddedFlow).not.toHaveBeenCalled();
	});

	test('should throw UnsupportedFlowError when called with an unsupported mode', () => {
		// @ts-expect-error: Testing unsupported mode
		expect(() => index.initFlow({ mode: 'unsupported' })).throw(UnsupportedFlowError);
	});
});
