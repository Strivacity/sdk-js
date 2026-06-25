/* eslint-disable no-console */
import type { SDKLogging } from '../types/common';

export function createDefaultLogging(): SDKLogging {
	const logger: SDKLogging = {
		xEventId: undefined,
		debug(message: string): void {
			const msg = logger.xEventId ? `(${logger.xEventId}) ${message}` : message;
			console.log(msg);
		},
		info(message: string): void {
			const msg = logger.xEventId ? `(${logger.xEventId}) ${message}` : message;
			console.info(msg);
		},
		warn(message: string): void {
			const msg = logger.xEventId ? `(${logger.xEventId}) ${message}` : message;
			console.warn(msg);
		},
		error(message: string, error: Error): void {
			const msg = logger.xEventId ? `(${logger.xEventId}) ${message}` : message;
			console.error(`${msg} - ${error}`);
		},
	};

	return logger;
}
