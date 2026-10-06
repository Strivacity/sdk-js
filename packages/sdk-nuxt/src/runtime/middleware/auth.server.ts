import { appendResponseHeader } from 'h3';
import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
import { flushSetCookies, toClientSession } from '@strivacity/sdk-core/utils';
import { useSession } from '../composables/use-session';

export default defineNuxtRouteMiddleware(async () => {
	if (!import.meta.server) {
		return;
	}

	const app = useNuxtApp();
	const h3Event = app.ssrContext!.event;

	const { useStrivacity } = await import('../server/composables/use-strivacity');
	const sdk = useStrivacity(h3Event);

	const session = await sdk.getSession();

	for (const cookie of flushSetCookies(h3Event, new Response(null)).headers.getSetCookie()) {
		appendResponseHeader(h3Event, 'set-cookie', cookie);
	}

	useSession().value = toClientSession(session) ?? undefined;
});
