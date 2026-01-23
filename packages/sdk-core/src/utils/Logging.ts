/* eslint-disable no-console */
import type { SDKLogging } from '../types';

export class DefaultLogging implements SDKLogging {
	xEventId: string | undefined;

	debug(message: string): void {
		const msg = this.xEventId ? `(${this.xEventId}) ${message}` : message;
		console.log(msg);
	}

	info(message: string): void {
		const msg = this.xEventId ? `(${this.xEventId}) ${message}` : message;
		console.info(msg);
	}

	warn(message: string): void {
		const msg = this.xEventId ? `(${this.xEventId}) ${message}` : message;
		console.warn(msg);
	}

	error(message: string, error: Error): void {
		const msg = this.xEventId ? `(${this.xEventId}) ${message}` : message;
		console.error(`${msg} - ${error}`);
	}
}
