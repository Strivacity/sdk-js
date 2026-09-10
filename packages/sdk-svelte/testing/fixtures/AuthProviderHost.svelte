<script lang="ts">
	import { createStyAuthProvider } from '../../src/client/components.svelte';
	import type { StyAuthProviderProps, SDKContext, RedirectFlow, PopupFlow, NativeFlow, EmbeddedFlow, SessionData } from '../../src/types';
	import StrivacityConsumer from './StrivacityConsumer.svelte';

	type Flow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow;

	const { options, initialSession = null }: { options: StyAuthProviderProps['options']; initialSession?: SessionData | null } = $props();

	let session = $state<SessionData | null | undefined>(initialSession);

	const ctx: SDKContext<Flow> = createStyAuthProvider({ options, session: () => session });
	let childInstance: { getContextValue: () => SDKContext<Flow> } | undefined;

	export function getContextValue() {
		return ctx;
	}

	export function setSession(value: SessionData | null | undefined) {
		session = value;
	}

	// exposes what a descendant reads via useStrivacity(), to verify createStyAuthProvider's context reaches its children
	export function getChildContextValue() {
		return childInstance?.getContextValue();
	}
</script>

<StrivacityConsumer bind:this={childInstance} />
