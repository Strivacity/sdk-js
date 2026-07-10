<script setup lang="ts">
import type { LayoutWidget, Widget } from '@strivacity/sdk-nuxt';
import { widgets } from './widgets';
import { NativeLoginWidgetRenderer } from './NativeLoginWidgetRenderer';

defineProps<{
	layout?: LayoutWidget;
}>();
</script>

<template>
	<!-- NativeLoginWidgetRenderer walks the layout tree and, for each placeholder -->
	<!-- looks up its widget data by id in the current forms and picks the matching Vue component from the `widgets` map -->
	<section class="login-renderer">
		<component :is="widgets.layout" :formId="(layout?.items?.[0] as Widget | undefined)?.formId" :type="layout?.type" tag="form">
			<NativeLoginWidgetRenderer :items="layout?.items" />
		</component>
	</section>
</template>
