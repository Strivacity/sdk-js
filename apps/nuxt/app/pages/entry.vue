<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { entry } = useStrivacity();

onMounted(async () => {
	try {
		const sessionId = await entry();

		if (sessionId) {
			await router.push(`/callback?session_id=${sessionId}`);
		} else {
			await router.push('/');
		}
	} catch (error) {
		alert(error);
		await router.push('/');
	}
});
</script>

<template>
	<section>
		<h1>Redirecting...</h1>
	</section>
</template>
