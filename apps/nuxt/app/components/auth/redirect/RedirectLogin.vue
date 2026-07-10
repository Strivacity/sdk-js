<script setup lang="ts">
import { type Component, defineComponent, onMounted, h } from 'vue';
import type { RedirectFlow } from '@strivacity/sdk-nuxt';
import { useStrivacity } from '#imports';
import { extraParams } from '../';

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const { sdk } = useStrivacity();

// in your own app, keep only the branch matching your `serverSessionUri` setting.
const modeComponent: Component = sdk.options.serverSessionUri
	? defineComponent({
			async setup() {
				await navigateTo({ path: `/auth/${props.flowType}`, query: extraParams }, { redirectCode: 301, external: true });

				return () => h('section', 'Loading...');
			},
		})
	: defineComponent({
			setup() {
				const { login, register } = useStrivacity<RedirectFlow>();

				onMounted(async () => {
					if (props.flowType === 'register') {
						await register(extraParams);
					} else {
						await login(extraParams);
					}
				});

				return () => h('section', 'Loading...');
			},
		});
</script>

<template>
	<component :is="modeComponent" />
</template>
