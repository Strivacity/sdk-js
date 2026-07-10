import { defineEventHandler, getRequestHeader, setResponseHeader } from 'h3';

export default defineEventHandler((event) => {
	if (!event.path?.startsWith('/auth/')) {
		return;
	}

	const origin = getRequestHeader(event, 'origin') ?? '';

	setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true');
	setResponseHeader(event, 'Access-Control-Allow-Origin', origin);
	setResponseHeader(event, 'Access-Control-Expose-Headers', 'content-length,content-range,x-event-id');
});
