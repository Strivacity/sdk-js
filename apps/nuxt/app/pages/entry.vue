<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { entry } = useStrivacity();

onMounted(async () => {
	try {
		const data = await entry();

		if (data && Object.keys(data).length > 0) {
			await router.push(`/callback?${new URLSearchParams(data).toString()}`);
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
