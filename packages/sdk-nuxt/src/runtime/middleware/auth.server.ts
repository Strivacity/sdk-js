import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
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

	if (session) {
		delete session.refresh_token;
		delete session.id_token;
	}

	useSession().value = session ?? undefined;
});
