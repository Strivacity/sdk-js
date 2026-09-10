<script setup lang="ts">
import type { NativeFlow } from '@strivacity/sdk-vue';
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';

const ctx = useStrivacity<NativeFlow>();
const router = useRouter();

onMounted(async () => {
	try {
		const params = await ctx.entry();
		const url = new URL('/login', globalThis.location.origin);
		url.search = new URLSearchParams(params).toString();
		globalThis.location.href = url.toString();
	} catch (error) {
		void router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		return;
	}
});
</script>
