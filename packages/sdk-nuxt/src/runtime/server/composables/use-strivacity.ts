import type { H3Event } from 'h3';

export const useStrivacity = (event: H3Event) => {
	if (import.meta.client) {
		throw new Error('The "useStrivacity" composable should only be used on the server.');
	}

	if (!event) {
		throw new Error('useStrivacity() can not be called without passing an H3Event instance.');
	}

	return event.context.strivacity.sdk;
};
