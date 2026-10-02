import { defineNuxtPlugin } from '#app';
import { getClientContext } from '../composables/use-strivacity';

/**
 * Creates the browser SDK instance as soon as the Nuxt app starts on the client (it is never created during SSR), and
 * exposes it as `useNuxtApp().$strivacity`. `useStrivacity()` returns the same context.
 */
export default defineNuxtPlugin({
	name: 'strivacity',
	setup() {
		return {
			provide: {
				strivacity: getClientContext(),
			},
		};
	},
});
