<script lang="ts">
	import { useNativeLoginContext } from '../../src/client/hooks.svelte';
	import type { LoginContext } from '../../src/types';

	const context: LoginContext = useNativeLoginContext();

	export function getContextValue() {
		return context;
	}
</script>
