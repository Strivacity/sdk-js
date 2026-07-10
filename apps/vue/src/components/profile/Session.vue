<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { DateTime } from 'luxon';

const { sdk, refresh } = useStrivacity();
const router = useRouter();

async function handleRefresh() {
	try {
		await refresh();
		globalThis.location.reload();
	} catch (error) {
		void router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
}
</script>

<template>
	<section>
		<h2>Session</h2>
		<dl>
			<dt>expires</dt>
			<dd>{{ sdk.session?.expires_at ? DateTime.fromMillis(sdk.session?.expires_at * 1000).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS) : '-' }}</dd>

			<dt>access token</dt>
			<dd>{{ sdk.session?.access_token }}</dd>

			<dt>refresh token</dt>
			<dd>{{ sdk.session?.refresh_token }}</dd>

			<template v-if="sdk.session?.refresh_token">
				<dt></dt>
				<dd><button @click="handleRefresh">Refresh</button></dd>
			</template>

			<dt>account id</dt>
			<dd>{{ sdk.session?.claims?.sub ?? '-' }}</dd>

			<dt>claims</dt>
			<dd>
				<pre>{{ JSON.stringify(sdk.session?.claims, null, 2) }}</pre>
			</dd>
		</dl>
	</section>
</template>
