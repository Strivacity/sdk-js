<script lang="ts">
	import { useStrivacity } from '../../src/client/hooks.svelte';
	import type { SDKContext, RedirectFlow, PopupFlow, NativeFlow, EmbeddedFlow } from '../../src/types';

	const ctx: SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = useStrivacity();

	export function getContextValue() {
		return ctx;
	}
</script>
