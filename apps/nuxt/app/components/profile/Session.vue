<script setup lang="ts">
import { DateTime } from 'luxon';
import { useRouter, useStrivacity } from '#imports';

const { sdk, refresh } = useStrivacity();
const router = useRouter();

async function handleRefresh() {
	// NOTE: This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSideSession` setting.
	if (sdk.options.serverSideSession) {
		globalThis.location.href = '/auth/refresh?returnTo=profile';
		return;
	} else {
		try {
			await refresh();
		} catch (error) {
			await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
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
