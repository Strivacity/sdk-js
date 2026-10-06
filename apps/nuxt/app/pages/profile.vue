<script setup lang="ts">
import '@strivacity/common/components/token-field';

import { useFetch, useStrivacity } from '#imports';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const ctx = useStrivacity();
const serverManaged = !!ctx.sdk.options.serverSessionUri;

// This demo shows both session modes side by side.
// Server-managed: the SDK keeps the ID and refresh tokens out of the page payload, so this demo reads the full session
// from its own demo-only route (server/api/session.get.ts). Client-managed: the browser SDK holds the full session.
const { data: serverSession } = await useFetch('/api/session', { immediate: serverManaged });
const session = computed(() => (serverManaged ? serverSession.value : ctx.sdk.session));

definePageMeta({
	middleware: ['auth'],
});

async function handleRefresh() {
	// Server-managed sessions: refresh() navigates to the server's refresh route (`${authUrlPrefix}/refresh`), which comes back to /profile
	try {
		await ctx.refresh({ returnTo: '/profile' });

		if (!ctx.sdk.options.serverSessionUri) {
			globalThis.location.reload();
		}
	} catch (error) {
		void router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
}
</script>

<template>
	<client-only>
		<section>
			<sty-app-token-field type="id_token" :value="session?.id_token"></sty-app-token-field>
			<sty-app-token-field type="access_token" :value="session?.access_token" :expiresAt="session?.expires_at"></sty-app-token-field>
			<sty-app-token-field type="refresh_token" :value="session?.refresh_token" @refreshToken="handleRefresh"></sty-app-token-field>
		</section>
	</client-only>
</template>
