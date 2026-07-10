<script setup lang="ts">
import type { NativeFlow } from '@strivacity/sdk-vue';
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';

const { sdk, entry } = useStrivacity<NativeFlow>();
const router = useRouter();

onMounted(async () => {
	if (!['embedded', 'native'].includes(sdk.options.mode)) {
		return await router.push('/login');
	}

	try {
		const params = await entry();
		const url = new URL(sdk.options.loginUri, globalThis.location.origin);
		url.search = new URLSearchParams(params).toString();
		globalThis.location.href = url.toString();
	} catch (error) {
		void router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		return;
	}
});
</script>
