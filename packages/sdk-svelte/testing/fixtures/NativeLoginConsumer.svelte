<script lang="ts">
	import { useNativeLogin } from '../../src/client/hooks.svelte';
	import type { UseNativeLoginOptions, LoginContext } from '../../src/types';
	import NativeLoginContextConsumer from './NativeLoginContextConsumer.svelte';

	const { options = {} }: { options?: UseNativeLoginOptions } = $props();

	const login: LoginContext = useNativeLogin(options);
	let childInstance: { getContextValue: () => LoginContext } | undefined;

	export function getLogin() {
		return login;
	}

	// exposes what a descendant widget sees via useNativeLoginContext(), to verify it resolves to the same context
	export function getChildContext() {
		return childInstance?.getContextValue();
	}
</script>

<NativeLoginContextConsumer bind:this={childInstance} />
