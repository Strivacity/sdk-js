<script setup lang="ts">
import '@strivacity/common/components/token-field';

import { useStrivacity } from '#imports';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const ctx = useStrivacity();
const session = computed(() => ctx.sdk.session);

definePageMeta({
	middleware: ['auth'],
});

async function handleRefresh() {
	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	if (ctx.sdk.options.serverSessionUri) {
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	} else {
		try {
			await ctx.refresh();
			globalThis.location.reload();
		} catch (error) {
			void router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
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
