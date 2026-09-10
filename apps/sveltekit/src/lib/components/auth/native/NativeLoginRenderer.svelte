<script lang="ts">
	import type { LayoutWidget, Widget } from '@strivacity/sdk-svelte/client';
	import { widgets } from './widgets';
	import NativeLoginWidgetRenderer from './NativeLoginWidgetRenderer.svelte';

	let { layout }: { layout?: LayoutWidget } = $props();
</script>

<!-- NativeLoginWidgetRenderer walks the layout tree and, for each placeholder -->
<!-- looks up its widget data by id in the current forms and picks the matching Svelte component from the `widgets` map -->
<section class="login-renderer">
	<widgets.layout formId={(layout?.items?.[0] as Widget | undefined)?.formId} type={layout?.type} tag="form">
		<NativeLoginWidgetRenderer items={layout?.items} />
	</widgets.layout>
</section>
