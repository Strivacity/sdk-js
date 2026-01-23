import { vi, describe, test, beforeEach, expect, type MockInstance } from 'vitest';
import { DefaultLogging } from '../../src/utils/Logging';
import * as expectedImports from '../../src/utils/Logging';

describe('DefaultLogging', () => {
	let logging: DefaultLogging;
	let consoleLogSpy: MockInstance;
	let consoleInfoSpy: MockInstance;
	let consoleWarnSpy: MockInstance;
	let consoleErrorSpy: MockInstance;

	beforeEach(() => {
		logging = new DefaultLogging();
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	test('should export the correct things', () => {
		expect(Object.keys(expectedImports)).toHaveLength(1);
		expect(expectedImports).toHaveProperty('DefaultLogging');
	});

	test('debug should call console.log without xEventId', () => {
		logging.debug('test message');
		expect(consoleLogSpy).toHaveBeenCalledWith('test message');
	});

	test('debug should call console.log with xEventId', () => {
		logging.xEventId = 'event-123';
		logging.debug('test message');
		expect(consoleLogSpy).toHaveBeenCalledWith('(event-123) test message');
	});

	test('info should call console.info without xEventId', () => {
		logging.info('test message');
		expect(consoleInfoSpy).toHaveBeenCalledWith('test message');
	});

	test('info should call console.info with xEventId', () => {
		logging.xEventId = 'event-123';
		logging.info('test message');
		expect(consoleInfoSpy).toHaveBeenCalledWith('(event-123) test message');
	});

	test('warn should call console.warn without xEventId', () => {
		logging.warn('test message');
		expect(consoleWarnSpy).toHaveBeenCalledWith('test message');
	});

	test('warn should call console.warn with xEventId', () => {
		logging.xEventId = 'event-123';
		logging.warn('test message');
		expect(consoleWarnSpy).toHaveBeenCalledWith('(event-123) test message');
	});

	test('error should call console.error without xEventId', () => {
		const error = new Error('test error');
		logging.error('test message', error);
		expect(consoleErrorSpy).toHaveBeenCalledWith('test message - Error: test error');
	});

	test('error should call console.error with xEventId', () => {
		logging.xEventId = 'event-123';
		const error = new Error('test error');
		logging.error('test message', error);
		expect(consoleErrorSpy).toHaveBeenCalledWith('(event-123) test message - Error: test error');
	});
});
