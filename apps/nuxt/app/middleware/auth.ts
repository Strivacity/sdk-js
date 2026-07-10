export default defineNuxtRouteMiddleware(async (to) => {
	const { sdk } = useStrivacity();
	const isAuthenticated = sdk.options.serverSideSession ? !!useSession().value : await sdk.isAuthenticated;

	if (!isAuthenticated) {
		const returnToCookie = useCookie('sty.returnTo', { sameSite: 'lax', path: '/' });
		returnToCookie.value = to.path;

		return navigateTo('/login');
	}
});
