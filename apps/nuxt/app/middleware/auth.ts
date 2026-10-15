export default defineNuxtRouteMiddleware(async (to) => {
	const { sdk } = useStrivacity();

	// NOTE: With client-managed sessions the session lives in browser storage, so only the browser can decide.
	if (import.meta.server && !sdk.options.serverSessionUri) {
		return;
	}

	const isAuthenticated = sdk.options.serverSessionUri ? !!useSession().value : await sdk.isAuthenticated;

	if (!isAuthenticated) {
		return navigateTo({ path: '/login', query: { returnTo: to.fullPath } });
	}
});
