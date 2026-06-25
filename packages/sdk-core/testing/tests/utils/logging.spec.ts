import { describe, test, expect, vi } from 'vitest';
import { createDefaultLogging } from '../../../src/utils/logging';

describe('createDefaultLogging', () => {
	test('logs debug messages via console.log without an xEventId prefix', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logging = createDefaultLogging();

		logging.debug('hello');

		expect(logSpy).toHaveBeenCalledWith('hello');
	});

	test('prefixes debug messages with the xEventId when set', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logging = createDefaultLogging();
		logging.xEventId = 'event-1';

		logging.debug('hello');

		expect(logSpy).toHaveBeenCalledWith('(event-1) hello');
	});

	test('logs info messages via console.info', () => {
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const logging = createDefaultLogging();

		logging.info('hello');

		expect(infoSpy).toHaveBeenCalledWith('hello');
	});

	test('prefixes info messages with the xEventId when set', () => {
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const logging = createDefaultLogging();
		logging.xEventId = 'event-1';

		logging.info('hello');

		expect(infoSpy).toHaveBeenCalledWith('(event-1) hello');
	});

	test('logs warn messages via console.warn', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const logging = createDefaultLogging();

		logging.warn('hello');

		expect(warnSpy).toHaveBeenCalledWith('hello');
	});

	test('prefixes warn messages with the xEventId when set', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const logging = createDefaultLogging();
		logging.xEventId = 'event-1';

		logging.warn('hello');

		expect(warnSpy).toHaveBeenCalledWith('(event-1) hello');
	});

	test('logs error messages via console.error including the error', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logging = createDefaultLogging();
		const error = new Error('boom');

		logging.error('hello', error);

		expect(errorSpy).toHaveBeenCalledWith(`hello - ${error}`);
	});

	test('prefixes error messages with the xEventId when set', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logging = createDefaultLogging();
		logging.xEventId = 'event-1';
		const error = new Error('boom');

		logging.error('hello', error);

		expect(errorSpy).toHaveBeenCalledWith(`(event-1) hello - ${error}`);
	});
});
